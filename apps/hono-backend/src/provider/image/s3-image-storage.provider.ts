import { createHash, createHmac } from "node:crypto";
import type {
  ImageStorageProvider,
  PutImageObjectInput,
} from "./image-storage.provider.js";
import type { AwsCredentialProvider } from "./aws-credential.provider.js";

export interface S3ImageStorageConfig {
  region: string;
  bucket: string;
  endpoint?: string;
  credentials: AwsCredentialProvider;
  forcePathStyle?: boolean;
}

interface SignedRequest {
  url: URL;
  headers: Record<string, string>;
}

/**
 * AWS Signature V4를 사용해 S3 호환 객체 저장소에 접근합니다.
 *
 * 별도 AWS SDK에 의존하지 않아 AWS S3와 MinIO에서 동일하게 사용할 수 있습니다.
 */
export class S3ImageStorageProvider implements ImageStorageProvider {
  constructor(
    private readonly config: S3ImageStorageConfig,
    private readonly request: typeof fetch = fetch,
  ) {}

  /** 새 이미지를 저장하거나 같은 키의 이미지를 덮어씁니다. */
  async putObject(input: PutImageObjectInput): Promise<void> {
    const body = Buffer.from(input.bytes);
    const signed = await this.createSignedRequest(
      "PUT",
      input.storageKey,
      body,
      input.contentType,
      input.cacheControl,
    );
    const response = await this.request(signed.url, {
      method: "PUT",
      headers: signed.headers,
      body,
    });

    await this.assertSuccessful(response, "IMAGE_UPLOAD_FAILED");
  }

  /** 더 이상 사용하지 않는 이미지 객체를 삭제합니다. */
  async deleteObject(storageKey: string): Promise<void> {
    const signed = await this.createSignedRequest(
      "DELETE",
      storageKey,
      Buffer.alloc(0),
    );
    const response = await this.request(signed.url, {
      method: "DELETE",
      headers: signed.headers,
    });

    await this.assertSuccessful(response, "IMAGE_DELETE_FAILED");
  }

  /** S3 요청 URL과 Signature V4 인증 헤더를 생성합니다. */
  private async createSignedRequest(
    method: "PUT" | "DELETE",
    storageKey: string,
    body: Buffer,
    contentType?: string,
    cacheControl?: string,
  ): Promise<SignedRequest> {
    const credentials = await this.config.credentials();
    const now = new Date();
    const amzDate = toAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256(body);
    const url = this.createObjectUrl(storageKey);
    const headers: Record<string, string> = {
      host: url.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };

    if (contentType) headers["content-type"] = contentType;
    if (cacheControl) headers["cache-control"] = cacheControl;
    if (credentials.sessionToken) {
      headers["x-amz-security-token"] = credentials.sessionToken;
    }

    const sortedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = sortedHeaderNames
      .map((name) => `${name}:${headers[name]!.trim()}\n`)
      .join("");
    const signedHeaders = sortedHeaderNames.join(";");
    const canonicalRequest = [
      method,
      url.pathname,
      "",
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");
    const credentialScope = `${dateStamp}/${this.config.region}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256(canonicalRequest),
    ].join("\n");
    const signingKey = createSigningKey(
      credentials.secretAccessKey,
      dateStamp,
      this.config.region,
    );
    const signature = hmac(signingKey, stringToSign).toString("hex");

    headers.authorization =
      `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;
    delete headers.host;

    return { url, headers };
  }

  /** AWS의 virtual-host 방식과 MinIO의 path 방식 URL을 모두 지원합니다. */
  private createObjectUrl(storageKey: string): URL {
    const encodedKey = storageKey.split("/").map(encodeRfc3986).join("/");
    const endpoint = this.config.endpoint
      ? new URL(this.config.endpoint)
      : new URL(`https://s3.${this.config.region}.amazonaws.com`);
    const basePath = endpoint.pathname.replace(/\/+$/, "");

    if (this.config.forcePathStyle) {
      endpoint.pathname = `${basePath}/${encodeRfc3986(this.config.bucket)}/${encodedKey}`;
      return endpoint;
    }

    endpoint.hostname = `${this.config.bucket}.${endpoint.hostname}`;
    endpoint.pathname = `${basePath}/${encodedKey}`;
    return endpoint;
  }

  /** 저장소가 반환한 본문 일부를 포함해 운영 시 원인을 식별할 수 있게 합니다. */
  private async assertSuccessful(
    response: Response,
    errorCode: string,
  ): Promise<void> {
    if (response.ok) return;

    const responseBody = (await response.text()).slice(0, 500);
    throw new Error(`${errorCode}:${response.status}:${responseBody}`);
  }
}

/** S3가 요구하는 UTC 타임스탬프 형식으로 변환합니다. */
function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

/** 문자열이나 바이너리의 SHA-256 해시를 16진수로 반환합니다. */
function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

/** AWS Signature V4의 단계별 HMAC 키를 생성합니다. */
function createSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
): Buffer {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, "s3");
  return hmac(serviceKey, "aws4_request");
}

/** HMAC-SHA256 결과를 다음 서명 단계에서 사용할 Buffer로 반환합니다. */
function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

/** S3 canonical URI 규칙에 맞게 경로 조각을 인코딩합니다. */
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
