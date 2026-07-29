import { ERROR_CODES } from "@repo/constants";
import { UserAccountEntity, UserEntity } from "@repo/database";

import { UnauthorizedErrorException } from "../../common/exceptions/unauthorized.js";
import { AppDataSource } from "../../provider/database/typeorm-config.js";

/** 비밀번호 로그인에 필요한 로컬 계정 데이터를 조회합니다. */
export class LocalAuthRepository {
  /**
   * 이메일에 연결된 로컬 로그인 계정 정보를 조회합니다.
   * @param email 정규화된 사용자 이메일입니다.
   * @returns 사용자 관계가 포함된 로컬 계정입니다.
   */
  async getUserLoginInfoWithEmail(email: string): Promise<UserAccountEntity> {
    const userRepository = AppDataSource.getRepository(UserEntity);
    const userAccountRepository =
      AppDataSource.getRepository(UserAccountEntity);
    const user = await userRepository.findOneBy({ email });

    // 계정 존재 여부와 관계없이 동일한 외부 오류를 사용합니다.
    if (!user) {
      throw new UnauthorizedErrorException(ERROR_CODES.INVALID_CREDENTIALS);
    }

    const userAccount = await userAccountRepository.findOne({
      where: { provider: "LOCAL", user: { id: user.id } },
      relations: { user: true },
    });
    if (!userAccount) {
      throw new UnauthorizedErrorException(ERROR_CODES.INVALID_CREDENTIALS);
    }

    return userAccount;
  }
}

/** 애플리케이션에서 공유하는 로컬 인증 저장소입니다. */
export const localAuthRepository = new LocalAuthRepository();
