import "dotenv/config";
import { PRODUCT_ACCESS_MODE as PRODUCT_ACCESS_MODES } from "@repo/constants";
import { z } from "zod";

// 문자열 환경 변수를 엄격한 boolean 값으로 변환합니다.
const booleanFromEnv = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.enum(["true", "false"]))
  .transform((value: "true" | "false") => value === "true");

// 서버 시작 전에 필수 환경 변수와 기본값을 한 번에 검증합니다.
const envSchema = z
  .object({
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
    REFRESH_TOKEN_REUSE_GRACE_SECONDS: z.coerce
      .number()
      .int()
      .nonnegative()
      .max(60)
      .default(10),
    SIGNUP_MODE: z.enum(PRODUCT_ACCESS_MODES).optional(),
    PRODUCT_ACCESS_MODE: z.enum(PRODUCT_ACCESS_MODES).optional(),
    PILOT_BOOTSTRAP_ADMIN_EMAIL: z
      .email()
      .transform((email) => email.trim().toLowerCase())
      .optional(),
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

    IMAGE_STORAGE_DRIVER: z.enum(["s3"]).default("s3"),
    IMAGE_S3_REGION: z.string().trim().min(1),
    IMAGE_S3_BUCKET: z.string().trim().min(1),
    IMAGE_S3_ENDPOINT: z.url().optional(),
    IMAGE_S3_ACCESS_KEY_ID: z.string().trim().min(1),
    IMAGE_S3_SECRET_ACCESS_KEY: z.string().trim().min(1),
    IMAGE_S3_SESSION_TOKEN: z.string().trim().min(1).optional(),
    IMAGE_S3_FORCE_PATH_STYLE: booleanFromEnv.default(false),
    IMAGE_CDN_BASE_URL: z.url(),
    DEFAULT_USER_PROFILE_IMAGE_URL: z.url().optional(),
    DEFAULT_ORGANIZATION_PROFILE_IMAGE_URL: z.url().optional(),
    IMAGE_MAX_UPLOAD_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(5 * 1024 * 1024),

    RUNTIME_CONFIG_SIGNING_PRIVATE_KEY: z.string().trim().min(1).optional(),
    RUNTIME_CONFIG_SIGNING_KEY_ID: z.string().trim().min(1).default("default"),
    INTEGRATION_ENCRYPTION_KEY: z.string().trim().min(1).optional(),
    FIREWALL_WEBHOOK_SIGNING_SECRET: z.string().trim().min(16).optional(),
    FIREWALL_WEBHOOK_ALLOW_PRIVATE_NETWORK: booleanFromEnv.default(false),
    FIREWALL_WEBHOOK_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(500)
      .max(30_000)
      .default(5_000),
    FIREWALL_WEBHOOK_MAX_ATTEMPTS: z.coerce
      .number()
      .int()
      .min(1)
      .max(20)
      .default(8),
    FIREWALL_WEBHOOK_BATCH_SIZE: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(10),
    FIREWALL_WEBHOOK_POLL_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(250)
      .max(60_000)
      .default(1_000),
    FIREWALL_WEBHOOK_RETENTION_DAYS: z.coerce
      .number()
      .int()
      .min(1)
      .max(365)
      .default(30),

    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
  })
  .superRefine((value, context) => {
    if (
      value.INTEGRATION_ENCRYPTION_KEY &&
      Buffer.from(value.INTEGRATION_ENCRYPTION_KEY, "base64").length !== 32
    ) {
      context.addIssue({
        code: "custom",
        path: ["INTEGRATION_ENCRYPTION_KEY"],
        message:
          "Integration encryption key must be a base64-encoded 32-byte key.",
      });
    }
    if (value.NODE_ENV === "production" && !value.INTEGRATION_ENCRYPTION_KEY) {
      context.addIssue({
        code: "custom",
        path: ["INTEGRATION_ENCRYPTION_KEY"],
        message: "Production requires an integration encryption key.",
      });
    }
    if (
      value.NODE_ENV === "production" &&
      (!value.FIREWALL_WEBHOOK_SIGNING_SECRET ||
        value.FIREWALL_WEBHOOK_SIGNING_SECRET.length < 32)
    ) {
      context.addIssue({
        code: "custom",
        path: ["FIREWALL_WEBHOOK_SIGNING_SECRET"],
        message:
          "Production requires a firewall webhook signing secret of at least 32 characters.",
      });
    }
  });

// 잘못된 설정으로 서버가 일부만 기동되지 않도록 즉시 실패합니다.
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(z.treeifyError(parsed.error));

  throw new Error("Invalid environment variables");
}

/**
 * 검증과 타입 변환을 마친 애플리케이션 환경 설정입니다.
 *
 * 운영 환경은 설정 누락 시 초대 전용으로 닫히고, 개발·테스트 환경은 기존
 * 작업 흐름을 유지하도록 공개 모드를 사용합니다.
 */
export const env = {
  ...parsed.data,
  SIGNUP_MODE:
    parsed.data.SIGNUP_MODE ??
    (parsed.data.NODE_ENV === "production"
      ? PRODUCT_ACCESS_MODES.INVITE_ONLY
      : PRODUCT_ACCESS_MODES.PUBLIC),
  PRODUCT_ACCESS_MODE:
    parsed.data.PRODUCT_ACCESS_MODE ??
    (parsed.data.NODE_ENV === "production"
      ? PRODUCT_ACCESS_MODES.INVITE_ONLY
      : PRODUCT_ACCESS_MODES.PUBLIC),
};
