import { ERROR_CODES } from "@repo/constants";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { env } from "../../common/config/config.js";
import { UnauthorizedErrorException } from "../../common/exceptions/unauthorized.js";
import { coreRedis } from "../../provider/redis/redis-config.js";

const RefreshSessionSchema = z.object({
  sessionId: z.uuid(),
  userId: z.uuid(),
  secretHash: z.string().regex(/^[a-f0-9]{64}$/i),
  previousSecretHash: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  createdAt: z.number().int().nonnegative(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

// 현재 secret 확인과 세션 교체를 원자적으로 처리해 토큰 재사용을 감지합니다.
const ROTATE_REFRESH_SCRIPT = `
local current = redis.call("GET", KEYS[1])
if not current then
  return 0
end

local session = cjson.decode(current)
if session.secretHash ~= ARGV[1] then
  if session.previousSecretHash == ARGV[1] then
    redis.call("DEL", KEYS[1])
    return -2
  end
  return -1
end

redis.call("SET", KEYS[1], ARGV[2], "EX", ARGV[3])
return 1
`;

// 현재 또는 직전 secret이 일치할 때만 세션을 원자적으로 폐기합니다.
const REVOKE_REFRESH_SCRIPT = `
local current = redis.call("GET", KEYS[1])
if not current then
  return 0
end

local session = cjson.decode(current)
if session.secretHash ~= ARGV[1] and session.previousSecretHash ~= ARGV[1] then
  return -1
end

redis.call("DEL", KEYS[1])
return 1
`;

/** Refresh Token 저장소가 사용하는 최소 Redis 명령 집합입니다. */
export type RefreshTokenRedis = Pick<typeof coreRedis, "eval" | "get" | "set">;

/** Refresh Token 세션을 Redis에 저장하고 원자적으로 회전합니다. */
export class RefreshTokenStore {
  constructor(private readonly redis: RefreshTokenRedis = coreRedis) {}

  /**
   * Refresh Token 검증에 사용할 세션을 sliding TTL과 함께 저장합니다.
   * @param payload 원문 secret을 제외한 로그인 세션 정보입니다.
   */
  async saveRefresh(payload: RefreshSession): Promise<void> {
    await this.redis.set(
      this.getSessionKey(payload.sessionId),
      JSON.stringify(payload),
      "EX",
      env.REFRESH_TOKEN_TTL_SECONDS,
    );
  }

  /**
   * 세션 ID로 Refresh Session을 조회하고 저장 데이터 형식을 검증합니다.
   * @param sessionId 로그인 세션 식별자입니다.
   * @returns 검증된 Refresh Session입니다.
   */
  async getRefreshSession(sessionId: string): Promise<RefreshSession> {
    const refresh = await this.redis.get(this.getSessionKey(sessionId));
    if (!refresh) this.throwInvalidRefreshToken();

    try {
      return RefreshSessionSchema.parse(JSON.parse(refresh));
    } catch {
      // 손상됐거나 이전 형식인 데이터는 인증 실패로 처리합니다.
      this.throwInvalidRefreshToken();
    }
  }

  /**
   * 기존 secretHash가 일치할 때만 세션을 새 토큰 정보로 교체합니다.
   *
   * 교체할 때 TTL을 다시 설정해 sliding session을 유지합니다.
   * @param expectedSecretHash 현재 Refresh Token의 SHA-256 해시입니다.
   * @param replacement 교체할 Refresh Session입니다.
   */
  async rotateRefresh(
    expectedSecretHash: string,
    replacement: RefreshSession,
  ): Promise<void> {
    // 비교와 TTL 갱신을 한 Redis 명령으로 처리해 동시 rotation을 막습니다.
    const result = await this.redis.eval(
      ROTATE_REFRESH_SCRIPT,
      1,
      this.getSessionKey(replacement.sessionId),
      expectedSecretHash,
      JSON.stringify(replacement),
      env.REFRESH_TOKEN_TTL_SECONDS,
    );

    if (Number(result) !== 1) this.throwInvalidRefreshToken();
  }

  /** 현재 또는 직전 Refresh Token이 맞을 때 로그인 세션을 폐기합니다. */
  async revokeRefresh(
    expectedSecretHash: string,
    sessionId: string,
  ): Promise<void> {
    const result = await this.redis.eval(
      REVOKE_REFRESH_SCRIPT,
      1,
      this.getSessionKey(sessionId),
      expectedSecretHash,
    );

    if (Number(result) !== 1) this.throwInvalidRefreshToken();
  }

  /** 로그인 세션의 Redis key를 생성합니다. */
  private getSessionKey(sessionId: string): string {
    return `auth:session:${sessionId}`;
  }

  /** Refresh Token 인증 실패를 동일한 외부 오류로 변환합니다. */
  private throwInvalidRefreshToken(): never {
    throw new UnauthorizedErrorException(ERROR_CODES.INVALID_REFRESH_TOKEN);
  }
}

/** 애플리케이션에서 공유하는 Refresh Token 저장소입니다. */
export const refreshTokenStore = new RefreshTokenStore();
