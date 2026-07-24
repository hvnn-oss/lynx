import "dotenv/config";
import { z } from "zod";

// 문자열 환경 변수를 엄격한 boolean 값으로 변환합니다.
const booleanFromEnv = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.enum(["true", "false"]))
  .transform((value: "true" | "false") => value === "true");

// 서버 시작 전에 필수 환경 변수와 기본값을 한 번에 검증합니다.
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().int().positive().default(8000),
  FRONTEND_URL: z.url(),

  DATABASE_HOST: z.string().trim().min(1),
  DATABASE_PORT: z.coerce.number().int().positive(),
  DATABASE_NAME: z.string().trim().min(1),
  DATABASE_USERNAME: z.string().trim().min(1),
  DATABASE_PASSWORD: z.string(),
  DATABASE_SYNCHRONIZE: booleanFromEnv.default(false),
  DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(10),
  DATABASE_LOGGING: booleanFromEnv.default(false),

  CORE_REDIS_HOST: z.string().trim().min(1),
  CORE_REDIS_PORT: z.coerce.number().int().positive(),
  CORE_REDIS_PASSWORD: z.string().optional(),

  JWT_SECRET: z.string().trim().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive(),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive(),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60),
  OPENAPI_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  OPENAPI_RATE_LIMIT_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60),

  SMTP_HOST: z.string().trim().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USERNAME: z.string().trim().min(1),
  SMTP_PASSWORD: z.string().trim().min(1),
  SMTP_SECURE: booleanFromEnv.default(false),
  SMTP_FROM_EMAIL: z.email(),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});

// 잘못된 설정으로 서버가 일부만 기동되지 않도록 즉시 실패합니다.
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(z.treeifyError(parsed.error));

  throw new Error("Invalid environment variables");
}

/** 검증과 타입 변환을 마친 애플리케이션 환경 설정입니다. */
export const env = parsed.data;
