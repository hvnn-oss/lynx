import { getProductionConfigIssues } from "./production-config-policy.js";

function validProductionConfig() {
  return {
    NODE_ENV: "production" as const,
    FRONTEND_URL: "https://app.lynxops.co",
    DATABASE_PASSWORD: "database-password-with-entropy",
    DATABASE_SYNCHRONIZE: false,
    DATABASE_SSL: true,
    CORE_REDIS_USERNAME: "lynx-api",
    CORE_REDIS_PASSWORD: "redis-password-with-entropy",
    CORE_REDIS_TLS: true,
    JWT_SECRET: "jwt-secret-with-at-least-thirty-two-random-characters",
    SMTP_USERNAME: "smtp-user",
    SMTP_PASSWORD: "smtp-password-with-entropy",
    SMTP_FROM_EMAIL: "noreply@lynxops.co",
    IMAGE_S3_ENDPOINT: undefined,
    IMAGE_S3_ACCESS_KEY_ID: undefined,
    IMAGE_S3_SECRET_ACCESS_KEY: undefined,
    IMAGE_CDN_BASE_URL: "https://cdn.lynxops.co",
    AWS_CONTAINER_CREDENTIALS_RELATIVE_URI: "/v2/credentials/task-id",
    AWS_CONTAINER_CREDENTIALS_FULL_URI: undefined,
    INTEGRATION_ENCRYPTION_KEY: Buffer.from(
      Array.from({ length: 32 }, (_, index) => index + 1),
    ).toString("base64"),
    FIREWALL_WEBHOOK_SIGNING_SECRET:
      "webhook-signing-secret-with-production-entropy",
    FIREWALL_WEBHOOK_ALLOW_PRIVATE_NETWORK: false,
  };
}

describe("production config policy", () => {
  it("ECS Task Role 기반 운영 설정을 허용한다", () => {
    expect(getProductionConfigIssues(validProductionConfig())).toEqual([]);
  });

  it("운영 환경의 로컬 비밀값과 비암호화 연결을 거부한다", () => {
    const issues = getProductionConfigIssues({
      ...validProductionConfig(),
      FRONTEND_URL: "http://localhost:3000",
      DATABASE_PASSWORD: "lynx-local-password",
      DATABASE_SSL: false,
      CORE_REDIS_PASSWORD: "local",
      CORE_REDIS_TLS: false,
      JWT_SECRET: "local-only-jwt-secret-change-before-use",
      INTEGRATION_ENCRYPTION_KEY: Buffer.from(
        "local-only-integration-key-12345",
      ).toString("base64"),
      FIREWALL_WEBHOOK_ALLOW_PRIVATE_NETWORK: true,
    });

    expect(issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        "FRONTEND_URL",
        "DATABASE_PASSWORD",
        "DATABASE_SSL",
        "CORE_REDIS_PASSWORD",
        "CORE_REDIS_TLS",
        "JWT_SECRET",
        "INTEGRATION_ENCRYPTION_KEY",
        "FIREWALL_WEBHOOK_ALLOW_PRIVATE_NETWORK",
      ]),
    );
  });

  it("AWS 기본 S3의 정적 키는 거부하고 MinIO endpoint의 키 쌍은 허용한다", () => {
    const awsIssues = getProductionConfigIssues({
      ...validProductionConfig(),
      IMAGE_S3_ACCESS_KEY_ID: "AKIAEXAMPLE",
      IMAGE_S3_SECRET_ACCESS_KEY: "secret-with-enough-entropy",
    });
    expect(awsIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "IMAGE_S3_ACCESS_KEY_ID" }),
      ]),
    );

    expect(
      getProductionConfigIssues({
        ...validProductionConfig(),
        IMAGE_S3_ENDPOINT: "https://minio.internal.example",
        IMAGE_S3_ACCESS_KEY_ID: "minio-service-account",
        IMAGE_S3_SECRET_ACCESS_KEY: "minio-secret-with-entropy",
      }),
    ).toEqual([]);
  });

  it("같은 byte를 반복한 로컬 암호화 키를 거부한다", () => {
    const issues = getProductionConfigIssues({
      ...validProductionConfig(),
      INTEGRATION_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "INTEGRATION_ENCRYPTION_KEY" }),
      ]),
    );
  });

  it("개발과 테스트 환경에는 운영 정책을 적용하지 않는다", () => {
    expect(
      getProductionConfigIssues({
        ...validProductionConfig(),
        NODE_ENV: "development",
        DATABASE_SSL: false,
        CORE_REDIS_TLS: false,
      }),
    ).toEqual([]);
  });
});
