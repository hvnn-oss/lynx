import { createMiddleware } from "hono/factory";
import { env } from "../config/config.js";
import type { AppEnv } from "../types/app-env.js";
import { coreRedis } from "../../provider/redis/redis-config.js";

/** Workspace API 키별 OpenAPI 요청 수를 고정 시간 구간으로 제한합니다. */
export const openApiRateLimitMiddleware = createMiddleware<AppEnv>(
  async (c, next) => {
    const apiKeyId = c.get("currentApiKeyId");
    const windowSeconds = env.OPENAPI_RATE_LIMIT_WINDOW_SECONDS;
    const bucket = Math.floor(Date.now() / (windowSeconds * 1_000));
    const key = `openapi-rate:${apiKeyId}:${bucket}`;

    try {
      const count = await coreRedis.incr(key);
      if (count === 1) await coreRedis.expire(key, windowSeconds + 1);
      const remaining = Math.max(0, env.OPENAPI_RATE_LIMIT_MAX - count);
      c.header("X-RateLimit-Limit", String(env.OPENAPI_RATE_LIMIT_MAX));
      c.header("X-RateLimit-Remaining", String(remaining));
      if (count > env.OPENAPI_RATE_LIMIT_MAX) {
        c.header("Retry-After", String(windowSeconds));
        return c.json(
          {
            code: "OPENAPI_RATE_LIMIT_EXCEEDED",
            message: "Too many OpenAPI requests.",
            requestId: c.get("requestId"),
          },
          429,
        );
      }
    } catch (error) {
      // Redis 장애가 고객의 이벤트 수집을 중단시키지 않도록 fail-open합니다.
      c.get("logger").warn(
        { event: "openapi.rate_limit.unavailable", err: error },
        "OpenAPI rate limiter unavailable",
      );
    }

    await next();
  },
);
