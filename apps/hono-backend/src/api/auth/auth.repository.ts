import { AppDataSource, UserAccountEntity, UserEntity } from "@repo/database";

/** 공통 인증 흐름에서 필요한 사용자 계정 데이터를 조회합니다. */
class AuthRepository {
  /**
   * 이메일을 통해 사용자의 로그인 정보를 찾습니다.
   * @param email 사용자의 이메일을 입력합니다.
   * @returns 이메일에 연결된 로그인 계정입니다.
   */
  async getLoginInfo(email: string) {
    const dataSource = AppDataSource;
    const userRepository = dataSource.getRepository(UserEntity);
    const accountRepository = dataSource.getRepository(UserAccountEntity);

    const foundUser = await userRepository.findOneBy({ email });
    if (!foundUser) {
      throw Error("Could not find user.");
    }
    const loginInfo = await accountRepository.findOneBy({ user: foundUser });
    if (!loginInfo) {
      throw Error("Could not find user's account info.");
    }
    return loginInfo;
  }
}

/** 애플리케이션에서 공유하는 인증 저장소입니다. */
export const authRepository = new AuthRepository();
