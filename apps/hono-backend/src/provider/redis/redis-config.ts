import { Redis } from "ioredis";
import { env } from "../../common/config/config.js";

/** 인증 세션과 제한 카운터에 사용하는 공용 Redis 연결입니다. */
export const coreRedis = new Redis({
  host: env.CORE_REDIS_HOST,
  username: env.CORE_REDIS_USERNAME,
  password: env.CORE_REDIS_PASSWORD,
  port: env.CORE_REDIS_PORT,
  tls: env.CORE_REDIS_TLS ? {} : undefined,
});
