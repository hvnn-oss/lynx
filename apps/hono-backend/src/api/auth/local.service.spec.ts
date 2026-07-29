import { ERROR_CODES } from "@repo/constants";
import { UserAccountEntity, UserEntity } from "@repo/database";
import bcrypt from "bcrypt";
import { LocalAuthService } from "./local.service.js";

describe("LocalAuthService", () => {
  const password = "same-password-123";
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    email: "user@example.com",
  } as UserEntity;

  async function createService() {
    const account = {
      id: "00000000-0000-4000-8000-000000000002",
      passwordHash: await bcrypt.hash(password, 4),
      provider: "LOCAL",
      user,
    } as UserAccountEntity;
    const repository = {
      getUserLoginInfoWithEmail: jest.fn().mockResolvedValue(account),
    };

    return {
      repository,
      service: new LocalAuthService(repository as never, {
        eval: jest.fn(),
      }),
    };
  }

  it("회원가입 때 해시한 비밀번호와 같은 입력을 허용한다", async () => {
    const { repository, service } = await createService();

    await expect(
      service.generateLoginIdentity({
        email: user.email,
        password,
      }),
    ).resolves.toEqual({
      method: "password",
      issuer: "lynx",
      subject: "00000000-0000-4000-8000-000000000002",
      email: user.email,
      attributes: {},
      userId: user.id,
    });
    expect(repository.getUserLoginInfoWithEmail).toHaveBeenCalledWith(
      user.email,
    );
  });

  it("저장된 해시와 다른 비밀번호를 거절한다", async () => {
    const { service } = await createService();

    await expect(
      service.validateUser({
        email: user.email,
        password: "different-password-123",
      }),
    ).rejects.toMatchObject({
      message: ERROR_CODES.INVALID_CREDENTIALS,
      status: 401,
    });
  });
});
