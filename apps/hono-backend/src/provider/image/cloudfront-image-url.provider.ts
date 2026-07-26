import type { ImageUrlProvider } from "./image-storage.provider.js";

/** CloudFront 또는 온프레미스 CDN의 공개 기준 URL을 사용합니다. */
export class PublicBaseImageUrlProvider implements ImageUrlProvider {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  /** 저장소 키의 각 경로 조각을 인코딩해 안전한 공개 URL을 만듭니다. */
  getUrl(storageKey: string): string {
    const encodedKey = storageKey
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");

    return `${this.baseUrl}/${encodedKey}`;
  }
}
