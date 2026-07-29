import { env } from "../../common/config/config.js";
import { PublicBaseImageUrlProvider } from "./cloudfront-image-url.provider.js";
import { ImageService } from "./image.service.js";
import { createImageS3CredentialProvider } from "./aws-credential.provider.js";
import { S3ImageStorageProvider } from "./s3-image-storage.provider.js";

let imageService: ImageService | null = null;

/**
 * 설정된 이미지 저장소 구현을 지연 생성합니다.
 *
 * AWS 필수 설정은 서버 시작 시 공통 config에서 검증되므로 여기서는
 * 검증된 값만 provider에 전달합니다.
 */
export function getImageService(): ImageService {
  if (imageService) return imageService;

  const storage = new S3ImageStorageProvider({
    region: env.IMAGE_S3_REGION,
    bucket: env.IMAGE_S3_BUCKET,
    endpoint: env.IMAGE_S3_ENDPOINT,
    credentials: createImageS3CredentialProvider(),
    forcePathStyle: env.IMAGE_S3_FORCE_PATH_STYLE,
  });
  const urls = new PublicBaseImageUrlProvider(env.IMAGE_CDN_BASE_URL);

  imageService = new ImageService(storage, urls, env.IMAGE_MAX_UPLOAD_BYTES);
  return imageService;
}
