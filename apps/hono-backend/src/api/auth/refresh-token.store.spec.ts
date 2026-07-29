import { ERROR_CODES } from "@repo/constants";
import { randomUUID } from "node:crypto";

import {
  RefreshTokenStore,
  type RefreshTokenRedis,
} from "./refresh-token.store.js";

type RedisMock = {
  eval: jest.MockedFunction<RefreshTokenRedis["eval"]>;
  get: jest.MockedFunction<RefreshTokenRedis["get"]>;
  set: jest.MockedFunction<RefreshTokenRedis["set"]>;
};

describe("RefreshTokenStore", () => {
  let redis: RedisMock;
  let store: RefreshTokenStore;

  beforeEach(() => {
    redis = {
      eval: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    };
    store = new RefreshTokenStore(redis);
  });

  describe("getRefreshSession", () => {
    it("Redis 값을 런타임 스키마로 검증한다", async () => {
      const session: RefreshSession = {
        createdAt: 1_700_000_000,
        secretHash: "a".repeat(64),
        sessionId: randomUUID(),
        userId: randomUUID(),
      };
      redis.get.mockResolvedValue(JSON.stringify(session));

      await expect(store.getRefreshSession(session.sessionId)).resolves.toEqual(
        session,
      );
    });

    it.each([null, "invalid-json", JSON.stringify({ sessionId: "invalid" })])(
      "없거나 손상된 세션을 인증 실패로 처리한다",
      async (storedValue: string | null) => {
        redis.get.mockResolvedValue(storedValue);

        await expect(
          store.getRefreshSession(randomUUID()),
        ).rejects.toMatchObject({
          message: ERROR_CODES.INVALID_REFRESH_TOKEN,
          status: 401,
        });
      },
    );
  });

  describe("rotateRefresh", () => {
    it("비교·교체 스크립트에 sliding TTL을 전달한다", async () => {
      const replacement: RefreshSession = {
        createdAt: 1_700_000_000,
        secretHash: "b".repeat(64),
        sessionId: randomUUID(),
        userId: randomUUID(),
      };
      redis.eval.mockResolvedValue(1);

      await store.rotateRefresh("a".repeat(64), replacement);

      expect(redis.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        `auth:session:${replacement.sessionId}`,
        "a".repeat(64),
        JSON.stringify(replacement),
        1_209_600,
        expect.any(Number),
        10,
      );
    });

    it.each([0, -1, -2, -3])(
      "누락 또는 재사용된 토큰을 거부한다",
      async (result: number) => {
        const replacement: RefreshSession = {
          createdAt: 1_700_000_000,
          secretHash: "b".repeat(64),
          sessionId: randomUUID(),
          userId: randomUUID(),
        };
        redis.eval.mockResolvedValue(result);

        await expect(
          store.rotateRefresh("a".repeat(64), replacement),
        ).rejects.toMatchObject({
          message: ERROR_CODES.INVALID_REFRESH_TOKEN,
          status: 401,
        });
      },
    );

    it("유예 구간의 직전 토큰 요청은 세션을 삭제하지 않는 스크립트를 사용한다", async () => {
      const replacement: RefreshSession = {
        createdAt: 1_700_000_000,
        previousSecretHash: "a".repeat(64),
        rotatedAt: 1_700_000_100,
        secretHash: "b".repeat(64),
        sessionId: randomUUID(),
        userId: randomUUID(),
      };
      redis.eval.mockResolvedValue(-2);

      await expect(
        store.rotateRefresh("a".repeat(64), replacement),
      ).rejects.toMatchObject({
        message: ERROR_CODES.INVALID_REFRESH_TOKEN,
      });

      const script = String(redis.eval.mock.calls[0]?.[0]);
      expect(script).toContain(
        "if rotatedAt > 0 and now - rotatedAt <= grace then",
      );
      expect(script.indexOf("return -2")).toBeLessThan(
        script.indexOf('redis.call("DEL", KEYS[1])'),
      );
    });
  });

  describe("revokeRefresh", () => {
    it("토큰 해시가 일치할 때 세션을 원자적으로 폐기한다", async () => {
      const sessionId = randomUUID();
      redis.eval.mockResolvedValue(1);

      await store.revokeRefresh("a".repeat(64), sessionId);

      expect(redis.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        `auth:session:${sessionId}`,
        "a".repeat(64),
      );
    });
  });
});
