import pino, { type Logger, type LoggerOptions } from "pino";

import { env } from "../config/config.js";

const isDevelopment = env.NODE_ENV === "development";

const options: LoggerOptions = {
  level: env.LOG_LEVEL,

  // 모든 로그에 서비스와 환경을 포함해 운영 환경에서 필터링할 수 있게 합니다.
  base: {
    service: "lynx-hono-backend",
    environment: env.NODE_ENV,
  },

  // 사람이 읽고 시스템 간 비교하기 쉬운 ISO 시각을 사용합니다.
  timestamp: pino.stdTimeFunctions.isoTime,

  // Error 객체의 message, type, stack을 구조화합니다.
  serializers: {
    err: pino.stdSerializers.err,
  },

  // 인증 정보와 비밀값이 실수로 로그에 포함돼도 원문을 남기지 않습니다.
  redact: {
    paths: [
      "authorization",
      "x-api-key",
      "headers.authorization",
      "headers.x-api-key",
      "req.headers.authorization",
      "req.headers.x-api-key",

      "password",
      "token",
      "accessToken",
      "refreshToken",
      "apiKey",

      "*.password",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
      "*.apiKey",

      // 중첩된 모니터 설정의 Authorization 헤더도 마스킹합니다.
      "monitor.headers.authorization",
      "monitor.headers.Authorization",
    ],
    censor: "[REDACTED]",
  },
};

// 개발 환경에서만 읽기 쉬운 pretty transport를 사용합니다.
const transport = isDevelopment
  ? pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        singleLine: false,
        ignore: "pid,hostname",
      },
    })
  : undefined;

/** 구조화된 로그와 민감정보 마스킹 설정을 적용한 전역 로거입니다. */
export const logger: Logger = pino(options, transport);
