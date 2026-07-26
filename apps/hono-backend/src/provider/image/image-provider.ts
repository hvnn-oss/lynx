import { env } from "../../common/config/config.js";
import { PublicBaseImageUrlProvider } from "./cloudfront-image-url.provider.js";
import { ImageService } from "./image.service.js";
import { S3ImageStorageProvider } from "./s3-image-storage.provider.js";

let imageService: ImageService | null = null;

/**
 * 설정된 이미지 저장소 구현을 지연 생성합니다.
 *
 * 새 드라이버를 추가할 때 이 팩토리에서 인터페이스 구현체만 교체합니다.
 */
export function getImageService(): ImageService {
  if (imageService) return imageService;

  const region = requireImageConfig("IMAGE_S3_REGION", env.IMAGE_S3_REGION);
  const bucket = requireImageConfig("IMAGE_S3_BUCKET", env.IMAGE_S3_BUCKET);
  const accessKeyId = requireImageConfig(
    "IMAGE_S3_ACCESS_KEY_ID",
    env.IMAGE_S3_ACCESS_KEY_ID,
  );
  const secretAccessKey = requireImageConfig(
    "IMAGE_S3_SECRET_ACCESS_KEY",
    env.IMAGE_S3_SECRET_ACCESS_KEY,
  );
  const publicBaseUrl = requireImageConfig(
    "IMAGE_CDN_BASE_URL",
    env.IMAGE_CDN_BASE_URL,
  );

  const storage = new S3ImageStorageProvider({
    region,
    bucket,
    endpoint: env.IMAGE_S3_ENDPOINT,
    accessKeyId,
    secretAccessKey,
    sessionToken: env.IMAGE_S3_SESSION_TOKEN,
    forcePathStyle: env.IMAGE_S3_FORCE_PATH_STYLE,
  });
  const urls = new PublicBaseImageUrlProvider(publicBaseUrl);

  imageService = new ImageService(storage, urls, env.IMAGE_MAX_UPLOAD_BYTES);
  return imageService;
}

/** 기능 사용 시점에 누락된 이미지 설정의 이름을 명확하게 알립니다. */
function requireImageConfig(name: string, value: string | undefined): string {
  if (value) return value;
  throw new Error(`IMAGE_CONFIG_MISSING:${name}`);
}
