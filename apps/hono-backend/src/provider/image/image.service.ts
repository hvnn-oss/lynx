import { randomUUID } from "node:crypto";
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
type ImageIdFactory = () => string;

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
    private readonly createImageId: ImageIdFactory = randomUUID,
  ) {}

  /** 검증한 프로필 이미지를 새로운 객체로 업로드합니다. */
  async upload(input: UploadProfileImageInput): Promise<StoredProfileImage> {
    const contentType = this.validate(input);
    const storageKey = this.createStorageKey(
      input.ownerType,
      input.ownerId,
      contentType,
    );
    return this.store(input, contentType, storageKey);
  }

  /** 새 이미지를 저장한 뒤 기존 이미지를 삭제해 안전하게 교체합니다. */
  async update(input: UpdateProfileImageInput): Promise<StoredProfileImage> {
    const contentType = this.validate(input);

    if (input.currentStorageKey) {
      this.assertOwnedProfileKey(
        input.ownerType,
        input.ownerId,
        input.currentStorageKey,
      );
    }

    // 새 URL을 사용해야 CloudFront에 남은 이전 객체 캐시의 영향을 받지 않습니다.
    const storageKey = this.createStorageKey(
      input.ownerType,
      input.ownerId,
      contentType,
    );
    const storedImage = await this.store(input, contentType, storageKey);

    if (input.currentStorageKey) {
      await this.storage.deleteObject(input.currentStorageKey);
    }

    return storedImage;
  }

  /** 소유자가 일치하는 프로필 이미지 객체를 저장소에서 삭제합니다. */
  async delete(
    ownerType: ProfileImageOwnerType,
    ownerId: string,
    storageKey: string | null,
  ): Promise<void> {
    if (!storageKey) return;
    this.assertOwnedProfileKey(ownerType, ownerId, storageKey);
    await this.storage.deleteObject(storageKey);
  }

  /** 저장소 키를 CloudFront 또는 셀프 호스팅 공개 URL로 변환합니다. */
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

  /** 소유자별 디렉터리에 캐시 충돌이 없는 고유한 객체 키를 만듭니다. */
  private createStorageKey(
    ownerType: ProfileImageOwnerType,
    ownerId: string,
    contentType: SupportedImageType,
  ): string {
    const extension = SUPPORTED_IMAGE_TYPES[contentType];
    return `${PROFILE_IMAGE_DIRECTORY}/${ownerType}s/${ownerId}/${this.createImageId()}.${extension}`;
  }

  /** 검증한 이미지 바이트를 지정한 키에 저장하고 공개 URL을 반환합니다. */
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

  /** 다른 소유자의 이미지를 교체 요청으로 삭제하지 못하게 제한합니다. */
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
