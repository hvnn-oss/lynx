import { UserAccountEntity, UserEntity } from "@repo/database";
import { AppDataSource } from "../../provider/database/typeorm-config.js";
import { LocalAuthRepository } from "./local.repository.js";

describe("LocalAuthRepository", () => {
  afterEach(() => jest.restoreAllMocks());

  it("사용자 ID로 로컬 로그인 계정을 조회한다", async () => {
    const user = {
      id: "00000000-0000-4000-8000-000000000001",
      email: "user@example.com",
    } as UserEntity;
    const account = {
      id: "00000000-0000-4000-8000-000000000002",
      provider: "LOCAL",
      user,
    } as UserAccountEntity;
    const userRepository = {
      findOneBy: jest.fn().mockResolvedValue(user),
    };
    const accountRepository = {
      findOne: jest.fn().mockResolvedValue(account),
    };

    jest.spyOn(AppDataSource, "getRepository").mockImplementation((entity) => {
      if (entity === UserEntity) return userRepository as never;
      if (entity === UserAccountEntity) return accountRepository as never;
      throw new Error("Unexpected repository");
    });

    await expect(
      new LocalAuthRepository().getUserLoginInfoWithEmail(user.email),
    ).resolves.toBe(account);
    expect(accountRepository.findOne).toHaveBeenCalledWith({
      where: {
        provider: "LOCAL",
        user: { id: user.id },
      },
      relations: { user: true },
    });
  });
});
