import { ERROR_CODES } from "@repo/constants";
import { authContract } from "@repo/contract";
import { getConnInfo } from "@hono/node-server/conninfo";
import bcrypt from "bcrypt";
import { createHash } from "node:crypto";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";

import { env } from "../../common/config/config.js";
import { UnauthorizedErrorException } from "../../common/exceptions/unauthorized.js";
import { coreRedis } from "../../provider/redis/redis-config.js";
import {
  localAuthRepository,
  LocalAuthRepository,
} from "./local.repository.js";

type RedisEvalClient = {
  eval(
    script: string,
    numberOfKeys: number,
    ...args: Array<string | number>
  ): Promise<unknown>;
};

// 여러 제한 키의 증가와 최초 TTL 설정을 하나의 Redis 연산으로 처리합니다.
const INCREMENT_ATTEMPT_SCRIPT = `
local highest = 0
for index, key in ipairs(KEYS) do
  local count = redis.call("INCR", key)
  if count == 1 then
    redis.call("EXPIRE", key, ARGV[1])
  end
  if count > highest then
    highest = count
  end
end
return highest
`;

/** 로컬 계정의 비밀번호를 검증하고 공통 인증 신원을 만듭니다. */
class LocalAuthService {
  constructor(
    private readonly repository: LocalAuthRepository = localAuthRepository,
    private readonly redis: RedisEvalClient = coreRedis,
  ) {}

  /**
   * 로컬 계정의 이메일과 비밀번호를 검증합니다.
   * @param loginDto 계약에서 검증된 로그인 입력입니다.
   * @returns 검증된 사용자와 계정 식별자입니다.
   */
  async validateUser(
    loginDto: z.infer<typeof authContract.login.request>,
  ): Promise<{ isValid: boolean; accId: string; userId: string }> {
    const loginInfo = await this.repository.getUserLoginInfoWithEmail(
      loginDto.email,
    );

    if (!loginInfo.passwordHash) {
      throw new UnauthorizedErrorException(ERROR_CODES.INVALID_CREDENTIALS);
    }

    const isPasswordMatch = await bcrypt.compare(
      loginDto.password,
      loginInfo.passwordHash,
    );
    if (!isPasswordMatch) {
      throw new UnauthorizedErrorException(ERROR_CODES.INVALID_CREDENTIALS);
    }

    return { userId: loginInfo.user.id, accId: loginInfo.id, isValid: true };
  }

  /**
   * 로컬 계정 검증 결과를 공통 인증 신원 형식으로 변환합니다.
   * @param loginDto 계약에서 검증된 로그인 입력입니다.
   * @returns 토큰 발급에 사용할 인증 신원입니다.
   */
  async generateLoginIdentity(
    loginDto: z.infer<typeof authContract.login.request>,
  ): Promise<AuthenticatedIdentity> {
    const { isValid, userId, accId } = await this.validateUser(loginDto);

    if (!isValid) {
      throw new UnauthorizedErrorException(ERROR_CODES.INVALID_CREDENTIALS);
    }

    return {
      method: "password",
      issuer: "lynx",
      subject: accId,
      email: loginDto.email,
      attributes: {},
      userId,
    };
  }

  /**
   * 계정, 원격 IP, 계정·IP 조합을 기준으로 로컬 로그인 시도를 제한합니다.
   * @param c 현재 Hono 요청 컨텍스트입니다.
   * @param email 정규화된 로그인 이메일입니다.
   */
  async assertAllowed(c: Context, email: string): Promise<void> {
    const remoteAddress = getConnInfo(c).remote.address ?? "unknown";
    const keys = this.createAttemptKeys(remoteAddress, email);
    const count = Number(
      await this.redis.eval(
        INCREMENT_ATTEMPT_SCRIPT,
        keys.length,
        ...keys,
        env.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
      ),
    );

    if (count > env.LOGIN_RATE_LIMIT_MAX) {
      throw new HTTPException(429, {
        message: ERROR_CODES.TOO_MANY_LOGIN_ATTEMPTS,
      });
    }
  }

  /** 개인정보 원문을 남기지 않고 서로 다른 우회 패턴을 제한할 키를 만듭니다. */
  private createAttemptKeys(remoteAddress: string, email: string): string[] {
    const accountFingerprint = this.hashFingerprint(email);
    const keys = [`auth:login-attempt:account:${accountFingerprint}`];

    // 주소를 알 수 없을 때 모든 사용자가 하나의 IP 제한을 공유하지 않게 합니다.
    if (remoteAddress === "unknown") return keys;

    const ipFingerprint = this.hashFingerprint(remoteAddress);
    const compositeFingerprint = this.hashFingerprint(
      `${remoteAddress}:${email}`,
    );

    return [
      ...keys,
      `auth:login-attempt:ip:${ipFingerprint}`,
      `auth:login-attempt:composite:${compositeFingerprint}`,
    ];
  }

  /** 로그인 제한 식별자를 고정 길이 SHA-256 값으로 변환합니다. */
  private hashFingerprint(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }
}

/** 애플리케이션에서 공유하는 로컬 인증 서비스입니다. */
export const localAuthService = new LocalAuthService();
