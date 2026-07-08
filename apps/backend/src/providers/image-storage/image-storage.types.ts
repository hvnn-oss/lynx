export interface SaveImageInput {
  // key는 DB에 저장할 영구 식별자입니다. 예: users/{userId}/profile.png
  key: string;
  body: Buffer;
  contentType: string;
}

export interface UpdateImageInput extends SaveImageInput {
  previousKey?: string;
}

export interface ImageStorageService {
  // 구현체가 S3든 MinIO든 앱은 이 인터페이스만 바라봅니다.
  saveImage(input: SaveImageInput): Promise<{ key: string; url: string }>;
  updateImage(input: UpdateImageInput): Promise<{ key: string; url: string }>;
  deleteImage(key: string): Promise<void>;
  getImageUrl(key: string): string;
}
