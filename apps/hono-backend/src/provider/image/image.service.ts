import type {
  ImageStorageProvider,
  ImageUrlProvider,
} from "./image-storage.provider.js";

const PROFILE_IMAGE_DIRECTORY = "profile-images";
const PROFILE_IMAGE_CACHE_CONTROL = "public, max-age=300, must-revalidate";
const SUPPORTED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
} as const;

type SupportedImageType = keyof typeof SUPPORTED_IMAGE_TYPES;
export type ProfileImageOwnerType = "user" | "organization";

export interface UploadProfileImageInput {
  ownerType: ProfileImageOwnerType;
  ownerId: string;
  contentType: string;
  bytes: Uint8Array;
}

export interface UpdateProfileImageInput extends UploadProfileImageInput {
  currentStorageKey: string | null;
}

export interface StoredProfileImage {
  storageKey: string;
  url: string;
}

/** 프로필 이미지 유스케이스와 실제 객체 저장소를 분리합니다. */
export class ImageService {
  constructor(
    private readonly storage: ImageStorageProvider,
    private readonly urls: ImageUrlProvider,
    private readonly maxUploadBytes: number,
  ) {}

  /** 검증된 프로필 이미지를 새 불변 객체로 업로드합니다. */
  async upload(input: UploadProfileImageInput): Promise<StoredProfileImage> {
    const contentType = this.validate(input);
    const storageKey = this.createStorageKey(input.ownerType, input.ownerId);
    return this.store(input, contentType, storageKey);
  }

  /**
   * 사용자별 고정 키를 덮어써 DB와 객체 저장소 사이의 참조를 유지합니다.
   */
  async update(input: UpdateProfileImageInput): Promise<StoredProfileImage> {
    const contentType = this.validate(input);
    const storageKey =
      input.currentStorageKey ??
      this.createStorageKey(input.ownerType, input.ownerId);

    if (input.currentStorageKey) {
      this.assertOwnedProfileKey(
        input.ownerType,
        input.ownerId,
        input.currentStorageKey,
      );
    }

    return this.store(input, contentType, storageKey);
  }

  /** 저장소 내부 키를 CloudFront 또는 온프레미스 공개 URL로 변환합니다. */
  getUrl(storageKey: string | null): string | null {
    if (!storageKey) return null;
    return this.urls.getUrl(storageKey);
  }

  /** 업로드 크기와 실행 가능한 SVG를 제외한 MIME 타입을 검증합니다. */
  private validate(input: UploadProfileImageInput): SupportedImageType {
    if (input.bytes.byteLength === 0) {
      throw new Error("PROFILE_IMAGE_EMPTY");
    }
    if (input.bytes.byteLength > this.maxUploadBytes) {
      throw new Error("PROFILE_IMAGE_TOO_LARGE");
    }
    if (!(input.contentType in SUPPORTED_IMAGE_TYPES)) {
      throw new Error("PROFILE_IMAGE_TYPE_NOT_SUPPORTED");
    }

    return input.contentType as SupportedImageType;
  }

  /** 사용자별 고정 키를 사용해 프로필 레코드 변경 없이 덮어쓸 수 있게 합니다. */
  private createStorageKey(
    ownerType: ProfileImageOwnerType,
    ownerId: string,
  ): string {
    return `${PROFILE_IMAGE_DIRECTORY}/${ownerType}s/${ownerId}/profile`;
  }

  /** 검증된 이미지 바이트를 지정한 키에 저장하고 공개 URL을 반환합니다. */
  private async store(
    input: UploadProfileImageInput,
    contentType: SupportedImageType,
    storageKey: string,
  ): Promise<StoredProfileImage> {
    await this.storage.putObject({
      storageKey,
      contentType,
      bytes: input.bytes,
      cacheControl: PROFILE_IMAGE_CACHE_CONTROL,
    });

    return {
      storageKey,
      url: this.urls.getUrl(storageKey),
    };
  }

  /** 다른 사용자의 이미지를 교체 요청으로 삭제하지 못하게 제한합니다. */
  private assertOwnedProfileKey(
    ownerType: ProfileImageOwnerType,
    ownerId: string,
    storageKey: string,
  ): void {
    const expectedPrefix = `${PROFILE_IMAGE_DIRECTORY}/${ownerType}s/${ownerId}/`;
    if (!storageKey.startsWith(expectedPrefix)) {
      throw new Error("PROFILE_IMAGE_KEY_OWNER_MISMATCH");
    }
  }
}
