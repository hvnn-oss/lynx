import { ConfigService } from '@nestjs/config';
import { S3ImageStorageService } from './s3-image-storage.service';

describe('S3ImageStorageService', () => {
  const configService = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        S3_REGION: 'ap-northeast-2',
        S3_BUCKET: 'lynx-profile-images',
        S3_ACCESS_KEY_ID: 'access-key',
        S3_SECRET_ACCESS_KEY: 'secret-key',
        S3_ENDPOINT: 'https://s3.ap-northeast-2.amazonaws.com',
        S3_FORCE_PATH_STYLE: 'false',
        CLOUDFRONT_DOMAIN: 'https://cdn.example.com',
      };

      return values[key];
    }),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
      } as Response),
    );
  });

  it('should resolve image urls through CloudFront', () => {
    const service = new S3ImageStorageService(configService);

    expect(service.getImageUrl('users/user 1/profile.png')).toBe(
      'https://cdn.example.com/users/user%201/profile.png',
    );
  });

  it('should save an image and return the public url', async () => {
    const service = new S3ImageStorageService(configService);

    const result = await service.saveImage({
      key: 'organizations/org-1/profile.png',
      body: Buffer.from('image'),
      contentType: 'image/png',
    });

    expect(result).toEqual({
      key: 'organizations/org-1/profile.png',
      url: 'https://cdn.example.com/organizations/org-1/profile.png',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      new URL(
        'https://lynx-profile-images.s3.ap-northeast-2.amazonaws.com/organizations/org-1/profile.png',
      ),
      expect.objectContaining({
        method: 'PUT',
        body: new Uint8Array(Buffer.from('image')),
      }),
    );
  });

  it('should replace the previous key when updating an image', async () => {
    const service = new S3ImageStorageService(configService);

    await service.updateImage({
      key: 'users/user-1/new.png',
      previousKey: 'users/user-1/old.png',
      body: Buffer.from('image'),
      contentType: 'image/png',
    });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      expect.any(URL),
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.any(URL),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('should support path-style S3-compatible endpoints', async () => {
    const pathStyleConfig = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          S3_REGION: 'us-east-1',
          S3_BUCKET: 'profile-images',
          S3_ACCESS_KEY_ID: 'access-key',
          S3_SECRET_ACCESS_KEY: 'secret-key',
          S3_ENDPOINT: 'http://localhost:9000',
          S3_FORCE_PATH_STYLE: 'true',
        };

        return values[key];
      }),
    } as unknown as ConfigService;
    const service = new S3ImageStorageService(pathStyleConfig);

    await service.deleteImage('users/user-1/profile.png');

    expect(global.fetch).toHaveBeenCalledWith(
      new URL('http://localhost:9000/profile-images/users/user-1/profile.png'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
