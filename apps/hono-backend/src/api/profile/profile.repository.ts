import { UserAccountEntity, UserEntity } from "@repo/database";
import { AppDataSource } from "../../provider/database/typeorm-config.js";

/** 사용자 프로필 저장 모델에 대한 조회와 변경을 담당합니다. */
export class ProfileRepository {
  /** 현재 사용자의 프로필 정보를 조회합니다. */
  findByUserId(userId: string): Promise<UserEntity | null> {
    return AppDataSource.getRepository(UserEntity).findOneBy({ id: userId });
  }

  /** 사용자의 프로필 이미지 저장소 키를 변경합니다. */
  async updateImageKey(userId: string, profileImageKey: string): Promise<void> {
    await AppDataSource.getRepository(UserEntity).update(
      { id: userId },
      { profileImageKey },
    );
  }

  async updateName(userId: string, name: string): Promise<void> {
    await AppDataSource.getRepository(UserEntity).update(
      { id: userId },
      { name },
    );
  }

  findLocalAccount(userId: string): Promise<UserAccountEntity | null> {
    return AppDataSource.getRepository(UserAccountEntity).findOne({
      where: { user: { id: userId }, provider: "LOCAL" },
    });
  }

  async updatePasswordHash(accountId: string, passwordHash: string) {
    await AppDataSource.getRepository(UserAccountEntity).update(
      { id: accountId },
      { passwordHash },
    );
  }
}

export const profileRepository = new ProfileRepository();
