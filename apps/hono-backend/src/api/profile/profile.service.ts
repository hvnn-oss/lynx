import type {
  ProfileImageResponseDto,
  UserProfileResponseDto,
} from "@repo/dto";
import { NotFoundErrorException } from "../../common/exceptions/not-found.js";
import type { ImageUploadBody } from "../../common/util/read-image-upload.js";
import { getImageService } from "../../provider/image/image-provider.js";
import type { ImageService } from "../../provider/image/image.service.js";
import { ProfileRepository, profileRepository } from "./profile.repository.js";
import { BadRequestErrorException } from "../../common/exceptions/bad-request.js";
import type { ChangePasswordDto, UpdateUserProfileDto } from "@repo/dto";
import bcrypt from "bcrypt";
import { BCRYPT_SALT_ROUNDS } from "@repo/constants";

type ImageServiceFactory = () => ImageService;

/** 로그인한 사용자의 프로필 조회와 이미지 변경을 처리합니다. */
export class ProfileService {
  constructor(
    private readonly repository: ProfileRepository = profileRepository,
    private readonly images: ImageServiceFactory = getImageService,
  ) {}

  /** 현재 사용자의 프로필과 공개 이미지 URL을 반환합니다. */
  async getProfile(userId: string): Promise<UserProfileResponseDto> {
    const user = await this.findUser(userId);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      profileImageUrl: this.getProfileImageUrl(user.profileImageKey),
    };
  }

  async updateProfile(
    userId: string,
    input: UpdateUserProfileDto,
  ): Promise<UserProfileResponseDto> {
    await this.findUser(userId);
    await this.repository.updateName(userId, input.name);
    return this.getProfile(userId);
  }

  async changePassword(userId: string, input: ChangePasswordDto) {
    const account = await this.repository.findLocalAccount(userId);
    if (!account?.passwordHash) {
      throw new BadRequestErrorException("PASSWORD_LOGIN_NOT_AVAILABLE");
    }
    const isCurrentPasswordValid = await bcrypt.compare(
      input.currentPassword,
      account.passwordHash,
    );
    if (!isCurrentPasswordValid) {
      throw new BadRequestErrorException("CURRENT_PASSWORD_INVALID");
    }
    const passwordHash = await bcrypt.hash(
      input.newPassword,
      BCRYPT_SALT_ROUNDS,
    );
    await this.repository.updatePasswordHash(account.id, passwordHash);
    return { success: true as const };
  }

  /** 현재 사용자의 프로필 이미지를 추가하거나 덮어씁니다. */
  async uploadImage(
    userId: string,
    upload: ImageUploadBody,
  ): Promise<ProfileImageResponseDto> {
    const user = await this.findUser(userId);

    try {
      const image = user.profileImageKey
        ? await this.images().update({
            ownerType: "user",
            ownerId: userId,
            currentStorageKey: user.profileImageKey,
            ...upload,
          })
        : await this.images().upload({
            ownerType: "user",
            ownerId: userId,
            ...upload,
          });

      await this.repository.updateImageKey(userId, image.storageKey);
      return { profileImageUrl: image.url };
    } catch (error) {
      this.rethrowImageInputError(error);
    }
  }

  /** 이미지 provider가 아직 설정되지 않은 프로필도 안전하게 조회합니다. */
  private getProfileImageUrl(storageKey: string | null): string | null {
    if (!storageKey) return null;
    return this.images().getUrl(storageKey);
  }

  /** 존재하지 않는 인증 사용자로 프로필을 만들지 않게 합니다. */
  private async findUser(userId: string) {
    const user = await this.repository.findByUserId(userId);
    if (!user) throw new NotFoundErrorException("USER_NOT_FOUND");
    return user;
  }

  /** 사용자 입력에 해당하는 이미지 오류만 HTTP 400으로 변환합니다. */
  private rethrowImageInputError(error: unknown): never {
    const message = error instanceof Error ? error.message : "";
    if (
      [
        "PROFILE_IMAGE_EMPTY",
        "PROFILE_IMAGE_TOO_LARGE",
        "PROFILE_IMAGE_TYPE_NOT_SUPPORTED",
      ].includes(message)
    ) {
      throw new BadRequestErrorException(message);
    }
    throw error;
  }
}

export const profileService = new ProfileService();
