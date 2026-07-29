import type { ApiKeyScope } from "@repo/constants";
import { ERROR_CODES } from "@repo/constants";
import { createMiddleware } from "hono/factory";
import {
  WorkspaceApiKeyAuthService,
  workspaceApiKeyAuthService,
} from "../auth/workspace-api-key-auth.service.js";
import { UnauthorizedErrorException } from "../exceptions/unauthorized.js";
import type { AppEnv } from "../types/app-env.js";
import {
  ProductAccessService,
  productAccessService,
} from "../access-control/product-access.service.js";

/**
 * `X-API-Key` 헤더의 Workspace API 키와 필수 권한을 검증합니다.
 *
 * 검증 결과는 이후 핸들러가 클라이언트 payload를 신뢰하지 않도록 Hono
 * context에 저장하며, 키가 없거나 유효하지 않으면 요청을 즉시 거절합니다.
 *
 * @param requiredScopes 엔드포인트 접근에 필요한 API 키 권한
 * @param authService 키 검증에 사용할 인증 서비스
 */
export function createWorkspaceApiKeyMiddleware(
  requiredScopes: readonly ApiKeyScope[] = [],
  authService: WorkspaceApiKeyAuthService = workspaceApiKeyAuthService,
  productAccess: Pick<
    ProductAccessService,
    "assertWorkspaceAccess"
  > = productAccessService,
) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const apiKey = c.req.header("X-API-Key")?.trim();
    if (!apiKey) {
      throw new UnauthorizedErrorException(ERROR_CODES.INVALID_API_KEY);
    }

    const authenticated = await authService.authenticate(
      apiKey,
      requiredScopes,
    );
    await productAccess.assertWorkspaceAccess(authenticated.workspaceId);
    // 이후 계층은 요청 본문 대신 검증된 context의 테넌트 정보를 사용합니다.
    c.set("currentWorkspaceId", authenticated.workspaceId);
    c.set("currentApiKeyId", authenticated.apiKeyId);
    c.set("currentApiKeyScopes", authenticated.scopes);
    c.set("currentApiKeyEnvironment", authenticated.environment);
    await next();
  });
}
