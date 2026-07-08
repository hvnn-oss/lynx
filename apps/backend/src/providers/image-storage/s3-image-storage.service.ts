import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'crypto';
import {
  ImageStorageService,
  SaveImageInput,
  UpdateImageInput,
} from './image-storage.types';

type HttpMethod = 'PUT' | 'DELETE';

interface S3ImageStorageConfig {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle: boolean;
  cloudfrontDomain?: string;
}

@Injectable()
export class S3ImageStorageService implements ImageStorageService {
  private config?: S3ImageStorageConfig;

  constructor(private readonly configService: ConfigService) {}

  async saveImage(input: SaveImageInput) {
    await this.putObject(input.key, input.body, input.contentType);
    return {
      key: input.key,
      url: this.getImageUrl(input.key),
    };
  }

  async updateImage(input: UpdateImageInput) {
    await this.saveImage(input);

    if (input.previousKey && input.previousKey !== input.key) {
      // 새 이미지 저장이 성공한 뒤에만 이전 이미지를 지웁니다.
      await this.deleteImage(input.previousKey);
    }

    return {
      key: input.key,
      url: this.getImageUrl(input.key),
    };
  }

  async deleteImage(key: string) {
    await this.sendSignedRequest('DELETE', key);
  }

  getImageUrl(key: string) {
    const config = this.getConfig();
    const encodedKey = this.encodeKeyPath(key);
    const cloudfrontDomain = config.cloudfrontDomain?.replace(/\/+$/, '');

    if (cloudfrontDomain) {
      // 이미지는 CloudFront를 통해 읽습니다. 저장소 key만 알면 공개 URL을 만들 수 있습니다.
      const normalizedDomain = cloudfrontDomain.startsWith('http')
        ? cloudfrontDomain
        : `https://${cloudfrontDomain}`;
      return `${normalizedDomain}/${encodedKey}`;
    }

    return this.getObjectUrl(key).toString();
  }

  private async putObject(key: string, body: Buffer, contentType: string) {
    await this.sendSignedRequest('PUT', key, body, contentType);
  }

  private async sendSignedRequest(
    method: HttpMethod,
    key: string,
    body?: Buffer,
    contentType?: string,
  ) {
    const url = this.getObjectUrl(key);
    const bodyHash = this.hashHex(body ?? Buffer.alloc(0));
    const amzDate = this.getAmzDate();
    const dateStamp = amzDate.slice(0, 8);
    const host = url.host;
    const canonicalUri = url.pathname;
    const canonicalHeaders =
      `host:${host}\n` +
      `x-amz-content-sha256:${bodyHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    // AWS Signature V4는 요청 내용을 정규화한 뒤 HMAC 서명을 붙이는 방식입니다.
    const canonicalRequest = [
      method,
      canonicalUri,
      '',
      canonicalHeaders,
      signedHeaders,
      bodyHash,
    ].join('\n');
    const config = this.getConfig();
    const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      this.hashHex(Buffer.from(canonicalRequest)),
    ].join('\n');
    const signature = this.sign(stringToSign, dateStamp);
    const authorization =
      `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers: Record<string, string> = {
      Authorization: authorization,
      'x-amz-content-sha256': bodyHash,
      'x-amz-date': amzDate,
    };

    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? new Uint8Array(body) : undefined,
    });

    if (!response.ok) {
      throw new InternalServerErrorException({
        message: `Failed to ${method === 'PUT' ? 'save' : 'delete'} image.`,
      });
    }
  }

  private getObjectUrl(key: string) {
    const config = this.getConfig();
    const endpoint =
      config.endpoint ?? `https://s3.${config.region}.amazonaws.com`;
    const baseUrl = new URL(endpoint);
    const encodedKey = this.encodeKeyPath(key);

    if (config.forcePathStyle) {
      // MinIO 같은 S3-compatible storage는 보통 /bucket/key 형태를 씁니다.
      baseUrl.pathname = this.joinPath(
        baseUrl.pathname,
        config.bucket,
        encodedKey,
      );
      return baseUrl;
    }

    // AWS S3 기본 형식은 bucket.s3.region.amazonaws.com/key 입니다.
    baseUrl.hostname = `${config.bucket}.${baseUrl.hostname}`;
    baseUrl.pathname = this.joinPath(baseUrl.pathname, encodedKey);
    return baseUrl;
  }

  private encodeKeyPath(key: string) {
    return key
      .split('/')
      .filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join('/');
  }

  private joinPath(...parts: string[]) {
    return parts
      .map((part) => part.replace(/^\/+|\/+$/g, ''))
      .filter(Boolean)
      .join('/')
      .replace(/^/, '/');
  }

  private hashHex(value: Buffer) {
    return createHash('sha256').update(value).digest('hex');
  }

  private sign(stringToSign: string, dateStamp: string) {
    const config = this.getConfig();
    const dateKey = this.hmac(`AWS4${config.secretAccessKey}`, dateStamp);
    const dateRegionKey = this.hmac(dateKey, config.region);
    const dateRegionServiceKey = this.hmac(dateRegionKey, 's3');
    const signingKey = this.hmac(dateRegionServiceKey, 'aws4_request');

    return createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  }

  private hmac(key: string | Buffer, value: string) {
    return createHmac('sha256', key).update(value).digest();
  }

  private getAmzDate() {
    return new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  }

  private getConfig(): S3ImageStorageConfig {
    if (this.config) return this.config;

    // 서버 부팅은 막지 않고, 실제 이미지 기능을 쓸 때 설정을 확인합니다.
    this.config = {
      region: this.getRequiredConfig('S3_REGION'),
      bucket: this.getRequiredConfig('S3_BUCKET'),
      accessKeyId: this.getRequiredConfig('S3_ACCESS_KEY_ID'),
      secretAccessKey: this.getRequiredConfig('S3_SECRET_ACCESS_KEY'),
      endpoint: this.configService.get<string>('S3_ENDPOINT') || undefined,
      forcePathStyle:
        this.configService.get<string>('S3_FORCE_PATH_STYLE') === 'true',
      cloudfrontDomain:
        this.configService.get<string>('CLOUDFRONT_DOMAIN') || undefined,
    };

    return this.config;
  }

  private getRequiredConfig(key: string) {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new InternalServerErrorException({
        message: `Missing required image storage configuration: ${key}`,
      });
    }

    return value;
  }
}
