import { createHash, timingSafeEqual } from "node:crypto";
import { ERROR_CODES, type ApiKeyScope } from "@repo/constants";
import { z } from "zod";
import { ForbiddenErrorException } from "../exceptions/forbidden.js";
import { UnauthorizedErrorException } from "../exceptions/unauthorized.js";
import type { ParsedApiKey } from "../types/app-env.js";
import { apiKeyParser } from "../util/api-key-parser.js";
import {
  WorkspaceApiKeyAuthRepository,
  workspaceApiKeyAuthRepository,
} from "./workspace-api-key-auth.repository.js";

const LAST_USED_TOUCH_INTERVAL_MS = 5 * 60 * 1_000;

/** 검증된 Workspace API 키에서 요청 context에 전달할 정보입니다. */
export type AuthenticatedWorkspaceApiKey = {
  /** API 키 record의 공개 식별자입니다. */
  apiKeyId: string;
  /** API 키가 접근할 수 있는 워크스페이스입니다. */
  workspaceId: string;
  /** API 키 문자열에 포함된 실행 환경입니다. */
  environment: string;
  /** API 키에 부여된 전체 권한 목록입니다. */
  scopes: ApiKeyScope[];
};

/** Workspace API 키의 형식, 상태, 해시와 필수 권한을 검증합니다. */
export class WorkspaceApiKeyAuthService {
  private readonly lastTouchedAtByApiKeyId = new Map<string, number>();

  /** 테스트에서 저장소를 교체할 수 있도록 의존성을 주입받습니다. */
  constructor(
    private readonly repository: WorkspaceApiKeyAuthRepository = workspaceApiKeyAuthRepository,
  ) {}

  /**
   * 원본 API 키를 인증하고 요청 context에 사용할 결과를 반환합니다.
   *
   * @param rawApiKey `X-API-Key` 헤더에서 읽은 원본 키
   * @param requiredScopes 엔드포인트가 요구하는 모든 권한
   * @throws 키가 잘못되면 401, 권한이 부족하면 403 예외를 던집니다.
   */
  async authenticate(
    rawApiKey: string,
    requiredScopes: readonly ApiKeyScope[] = [],
  ): Promise<AuthenticatedWorkspaceApiKey> {
    const parsed = this.parseApiKey(rawApiKey);
    const apiKey = await this.repository.findById(parsed.id);
    if (
      !apiKey ||
      apiKey.revokedAt ||
      (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now()) ||
      !this.matchesHash(rawApiKey, apiKey.keyHash)
    ) {
      this.throwInvalidApiKey();
    }

    const hasRequiredScopes = requiredScopes.every((scope) =>
      apiKey.scopes.includes(scope),
    );
    if (!hasRequiredScopes) {
      throw new ForbiddenErrorException(ERROR_CODES.API_KEY_SCOPE_REQUIRED);
    }

    this.touchLastUsed(apiKey.id);

    return {
      apiKeyId: apiKey.id,
      workspaceId: apiKey.workspaceId,
      environment: parsed.environment,
      scopes: apiKey.scopes,
    };
  }

  /** 요청마다 DB를 쓰지 않도록 인스턴스별로 최근 갱신 시각을 제한합니다. */
  private touchLastUsed(apiKeyId: string): void {
    const now = Date.now();
    const lastTouchedAt = this.lastTouchedAtByApiKeyId.get(apiKeyId) ?? 0;
    if (now - lastTouchedAt < LAST_USED_TOUCH_INTERVAL_MS) return;

    this.lastTouchedAtByApiKeyId.set(apiKeyId, now);
    void this.repository
      .touchLastUsed(
        apiKeyId,
        new Date(now),
        new Date(now - LAST_USED_TOUCH_INTERVAL_MS),
      )
      .catch(() => {
        // 인증 성공을 사용 시각 기록 실패와 결합하지 않습니다.
        this.lastTouchedAtByApiKeyId.delete(apiKeyId);
      });
  }

  /** 키 문자열을 분해하고 공개 식별자가 UUID인지 확인합니다. */
  private parseApiKey(rawApiKey: string): ParsedApiKey {
    try {
      const parsed = apiKeyParser(rawApiKey);
      if (!z.uuid().safeParse(parsed.id).success) this.throwInvalidApiKey();
      return parsed;
    } catch {
      this.throwInvalidApiKey();
    }
  }

  /** 저장된 SHA-256 해시를 시간차 공격에 안전하게 비교합니다. */
  private matchesHash(rawApiKey: string, storedHash: string): boolean {
    const presentedHash = createHash("sha256").update(rawApiKey).digest();
    const storedHashBuffer = Buffer.from(storedHash, "hex");
    return (
      storedHashBuffer.length === presentedHash.length &&
      timingSafeEqual(presentedHash, storedHashBuffer)
    );
  }

  /** 외부에 인증 실패 세부 원인을 노출하지 않고 공통 예외를 던집니다. */
  private throwInvalidApiKey(): never {
    throw new UnauthorizedErrorException(ERROR_CODES.INVALID_API_KEY);
  }
}

/** 애플리케이션에서 공유하는 Workspace API 키 인증 서비스입니다. */
export const workspaceApiKeyAuthService = new WorkspaceApiKeyAuthService();
