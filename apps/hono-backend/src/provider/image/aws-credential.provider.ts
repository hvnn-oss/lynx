import { env } from "../../common/config/config.js";

const ECS_CREDENTIALS_HOST = "169.254.170.2";
const ALLOWED_FULL_URI_HOSTS = new Set([
  ECS_CREDENTIALS_HOST,
  "169.254.170.23",
  "127.0.0.1",
  "::1",
  "localhost",
]);
const CREDENTIAL_REFRESH_WINDOW_MS = 5 * 60_000;

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  expiresAt?: Date;
}

export type AwsCredentialProvider = () => Promise<AwsCredentials>;

export interface AwsContainerCredentialConfig {
  relativeUri?: string;
  fullUri?: string;
  authorizationToken?: string;
  timeoutMs?: number;
}

interface AwsContainerCredentialResponse {
  AccessKeyId?: unknown;
  SecretAccessKey?: unknown;
  Token?: unknown;
  Expiration?: unknown;
}

/**
 * ECS가 Task Role 자격 증명을 노출하는 로컬 credential endpoint를 조회합니다.
 *
 * 만료 전까지만 메모리에 캐시하고, 갱신 시각이 가까워지면 다음 S3 요청에서
 * 자동으로 새 임시 자격 증명을 받습니다.
 */
export class AwsContainerCredentialProvider {
  private cachedCredentials?: AwsCredentials;

  constructor(
    private readonly config: AwsContainerCredentialConfig,
    private readonly request: typeof fetch = fetch,
  ) {}

  /** 현재 유효한 ECS 임시 자격 증명을 반환합니다. */
  async getCredentials(): Promise<AwsCredentials> {
    if (this.canReuse(this.cachedCredentials)) {
      return this.cachedCredentials;
    }

    const endpoint = this.resolveEndpoint();
    const headers: Record<string, string> = {};
    if (this.config.authorizationToken) {
      headers.Authorization = this.config.authorizationToken;
    }

    const response = await this.request(endpoint, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 2_000),
    });
    if (!response.ok) {
      throw new Error(`AWS_CONTAINER_CREDENTIALS_FAILED:${response.status}`);
    }

    const payload = (await response.json()) as AwsContainerCredentialResponse;
    const credentials = this.parseCredentials(payload);
    this.cachedCredentials = credentials;
    return credentials;
  }

  /** ECS가 자동 주입한 URI만 허용해 credential 조회가 임의 SSRF가 되지 않게 합니다. */
  private resolveEndpoint(): URL {
    if (this.config.relativeUri) {
      if (
        !this.config.relativeUri.startsWith("/") ||
        this.config.relativeUri.startsWith("//")
      ) {
        throw new Error("AWS_CONTAINER_CREDENTIALS_RELATIVE_URI_INVALID");
      }
      return new URL(this.config.relativeUri, `http://${ECS_CREDENTIALS_HOST}`);
    }

    if (!this.config.fullUri) {
      throw new Error("AWS_CONTAINER_CREDENTIALS_UNAVAILABLE");
    }
    const endpoint = new URL(this.config.fullUri);
    const hostname = endpoint.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (
      !["http:", "https:"].includes(endpoint.protocol) ||
      !ALLOWED_FULL_URI_HOSTS.has(hostname) ||
      endpoint.username ||
      endpoint.password
    ) {
      throw new Error("AWS_CONTAINER_CREDENTIALS_FULL_URI_NOT_ALLOWED");
    }
    return endpoint;
  }

  private parseCredentials(
    payload: AwsContainerCredentialResponse,
  ): AwsCredentials {
    if (
      typeof payload.AccessKeyId !== "string" ||
      !payload.AccessKeyId ||
      typeof payload.SecretAccessKey !== "string" ||
      !payload.SecretAccessKey ||
      typeof payload.Token !== "string" ||
      !payload.Token
    ) {
      throw new Error("AWS_CONTAINER_CREDENTIALS_RESPONSE_INVALID");
    }

    const expiresAt =
      typeof payload.Expiration === "string"
        ? new Date(payload.Expiration)
        : undefined;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new Error("AWS_CONTAINER_CREDENTIALS_EXPIRATION_INVALID");
    }

    return {
      accessKeyId: payload.AccessKeyId,
      secretAccessKey: payload.SecretAccessKey,
      sessionToken: payload.Token,
      expiresAt,
    };
  }

  private canReuse(
    credentials: AwsCredentials | undefined,
  ): credentials is AwsCredentials {
    if (!credentials) return false;
    if (!credentials.expiresAt) return true;
    return (
      credentials.expiresAt.getTime() - CREDENTIAL_REFRESH_WINDOW_MS >
      Date.now()
    );
  }
}

/**
 * 로컬·MinIO는 명시적 키를, AWS ECS는 Task Role을 사용하는 자격 증명 체인을 만듭니다.
 */
export function createImageS3CredentialProvider(): AwsCredentialProvider {
  if (env.IMAGE_S3_ACCESS_KEY_ID && env.IMAGE_S3_SECRET_ACCESS_KEY) {
    const credentials: AwsCredentials = {
      accessKeyId: env.IMAGE_S3_ACCESS_KEY_ID,
      secretAccessKey: env.IMAGE_S3_SECRET_ACCESS_KEY,
      sessionToken: env.IMAGE_S3_SESSION_TOKEN,
    };
    return async () => credentials;
  }

  const containerProvider = new AwsContainerCredentialProvider({
    relativeUri: env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI,
    fullUri: env.AWS_CONTAINER_CREDENTIALS_FULL_URI,
    authorizationToken: env.AWS_CONTAINER_AUTHORIZATION_TOKEN,
  });
  return () => containerProvider.getCredentials();
}
