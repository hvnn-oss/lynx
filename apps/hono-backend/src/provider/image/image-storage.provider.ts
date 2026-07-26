export interface PutImageObjectInput {
  storageKey: string;
  contentType: string;
  bytes: Uint8Array;
  cacheControl: string;
}

/**
 * 이미지 바이너리 저장소가 지켜야 하는 최소 계약입니다.
 *
 * S3나 MinIO 같은 제품별 구현은 이 인터페이스 뒤에 숨깁니다.
 */
export interface ImageStorageProvider {
  putObject(input: PutImageObjectInput): Promise<void>;
  deleteObject(storageKey: string): Promise<void>;
}

/** 저장된 이미지 키를 외부에서 접근 가능한 URL로 변환합니다. */
export interface ImageUrlProvider {
  getUrl(storageKey: string): string;
}
