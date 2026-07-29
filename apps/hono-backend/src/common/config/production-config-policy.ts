export interface ProductionConfigInput {
  NODE_ENV: "development" | "test" | "production";
  FRONTEND_URL: string;
  DATABASE_PASSWORD: string;
  DATABASE_SYNCHRONIZE: boolean;
  DATABASE_SSL: boolean;
  CORE_REDIS_USERNAME?: string;
  CORE_REDIS_PASSWORD?: string;
  CORE_REDIS_TLS: boolean;
  JWT_SECRET: string;
  SMTP_USERNAME: string;
  SMTP_PASSWORD: string;
  SMTP_FROM_EMAIL: string;
  IMAGE_S3_ENDPOINT?: string;
  IMAGE_S3_ACCESS_KEY_ID?: string;
  IMAGE_S3_SECRET_ACCESS_KEY?: string;
  IMAGE_CDN_BASE_URL: string;
  AWS_CONTAINER_CREDENTIALS_RELATIVE_URI?: string;
  AWS_CONTAINER_CREDENTIALS_FULL_URI?: string;
  INTEGRATION_ENCRYPTION_KEY?: string;
  FIREWALL_WEBHOOK_SIGNING_SECRET?: string;
  FIREWALL_WEBHOOK_ALLOW_PRIVATE_NETWORK: boolean;
}

export interface ProductionConfigIssue {
  path: keyof ProductionConfigInput;
  message: string;
}

const INSECURE_VALUE_PATTERN =
  /(local-only|change-before-use|changeme|example|dummy|test-secret)/i;

/**
 * 운영 환경에서 실수로 개발용 설정을 사용하는 경우를 서버 시작 전에 찾습니다.
 *
 * AWS 기본 S3는 ECS Task Role을 사용하고, 사용자 지정 S3 endpoint만 정적 키를
 * 허용합니다. 따라서 운영용 장기 AWS 액세스 키가 환경 변수에 남지 않습니다.
 */
export function getProductionConfigIssues(
  value: ProductionConfigInput,
): ProductionConfigIssue[] {
  if (value.NODE_ENV !== "production") return [];

  const issues: ProductionConfigIssue[] = [];
  const add = (path: keyof ProductionConfigInput, message: string): void => {
    issues.push({ path, message });
  };

  if (value.DATABASE_SYNCHRONIZE) {
    add(
      "DATABASE_SYNCHRONIZE",
      "Production must use migrations instead of schema synchronization.",
    );
  }
  if (!value.DATABASE_SSL) {
    add("DATABASE_SSL", "Production PostgreSQL connections must use TLS.");
  }
  if (
    value.DATABASE_PASSWORD.length < 16 ||
    isInsecureSecret(value.DATABASE_PASSWORD)
  ) {
    add(
      "DATABASE_PASSWORD",
      "Production requires a non-placeholder database password of at least 16 characters.",
    );
  }
  if (!value.CORE_REDIS_TLS) {
    add("CORE_REDIS_TLS", "Production Redis connections must use TLS.");
  }
  if (
    !value.CORE_REDIS_PASSWORD ||
    value.CORE_REDIS_PASSWORD.length < 16 ||
    isInsecureSecret(value.CORE_REDIS_PASSWORD)
  ) {
    add(
      "CORE_REDIS_PASSWORD",
      "Production requires a non-placeholder Redis password of at least 16 characters.",
    );
  }
  if (
    value.CORE_REDIS_USERNAME &&
    isInsecureSecret(value.CORE_REDIS_USERNAME)
  ) {
    add(
      "CORE_REDIS_USERNAME",
      "Production Redis username must not be a placeholder.",
    );
  }
  if (value.JWT_SECRET.length < 32 || isInsecureSecret(value.JWT_SECRET)) {
    add(
      "JWT_SECRET",
      "Production requires a non-placeholder JWT secret of at least 32 characters.",
    );
  }
  if (!isHttpsUrl(value.FRONTEND_URL)) {
    add("FRONTEND_URL", "Production frontend URL must use HTTPS.");
  }
  if (!isHttpsUrl(value.IMAGE_CDN_BASE_URL)) {
    add("IMAGE_CDN_BASE_URL", "Production image CDN URL must use HTTPS.");
  }
  if (
    isInsecureSecret(value.SMTP_USERNAME) ||
    value.SMTP_PASSWORD.length < 12 ||
    isInsecureSecret(value.SMTP_PASSWORD) ||
    value.SMTP_FROM_EMAIL.endsWith("@localhost.test")
  ) {
    add(
      "SMTP_PASSWORD",
      "Production SMTP settings must not use local or placeholder credentials.",
    );
  }

  const hasAccessKey = Boolean(value.IMAGE_S3_ACCESS_KEY_ID);
  const hasSecretKey = Boolean(value.IMAGE_S3_SECRET_ACCESS_KEY);
  if (hasAccessKey !== hasSecretKey) {
    add(
      hasAccessKey ? "IMAGE_S3_SECRET_ACCESS_KEY" : "IMAGE_S3_ACCESS_KEY_ID",
      "S3 static credentials must provide both access key ID and secret access key.",
    );
  }
  if (!value.IMAGE_S3_ENDPOINT && (hasAccessKey || hasSecretKey)) {
    add(
      "IMAGE_S3_ACCESS_KEY_ID",
      "Production AWS S3 must use the ECS Task Role instead of static credentials.",
    );
  }
  if (
    !value.IMAGE_S3_ENDPOINT &&
    !value.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI &&
    !value.AWS_CONTAINER_CREDENTIALS_FULL_URI
  ) {
    add(
      "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI",
      "Production AWS S3 requires an ECS Task Role credential endpoint.",
    );
  }
  if (value.IMAGE_S3_ENDPOINT && (!hasAccessKey || !hasSecretKey)) {
    add(
      "IMAGE_S3_ACCESS_KEY_ID",
      "A custom S3-compatible endpoint requires static credentials.",
    );
  }
  if (
    value.INTEGRATION_ENCRYPTION_KEY &&
    isInsecureIntegrationKey(value.INTEGRATION_ENCRYPTION_KEY)
  ) {
    add(
      "INTEGRATION_ENCRYPTION_KEY",
      "Production integration encryption key must not use the local placeholder.",
    );
  }
  if (
    value.FIREWALL_WEBHOOK_SIGNING_SECRET &&
    isInsecureSecret(value.FIREWALL_WEBHOOK_SIGNING_SECRET)
  ) {
    add(
      "FIREWALL_WEBHOOK_SIGNING_SECRET",
      "Production webhook signing secret must not use a placeholder.",
    );
  }
  if (value.FIREWALL_WEBHOOK_ALLOW_PRIVATE_NETWORK) {
    add(
      "FIREWALL_WEBHOOK_ALLOW_PRIVATE_NETWORK",
      "Production custom webhooks must not allow private-network destinations.",
    );
  }

  return issues;
}

function isInsecureSecret(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "local" ||
    normalized === "lynx-local-password" ||
    INSECURE_VALUE_PATTERN.test(value)
  );
}

/** Base64 설정값뿐 아니라 복호화한 로컬 placeholder 문구도 함께 검사합니다. */
function isInsecureIntegrationKey(value: string): boolean {
  const decodedBytes = Buffer.from(value, "base64");
  const decodedValue = decodedBytes.toString("utf8");
  const isRepeatedByte =
    decodedBytes.length > 0 &&
    decodedBytes.every((byte) => byte === decodedBytes[0]);
  return (
    isRepeatedByte || isInsecureSecret(value) || isInsecureSecret(decodedValue)
  );
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
