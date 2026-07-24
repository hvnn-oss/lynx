import {
  API_KEY_SCOPES,
  ERROR_CODES,
  ORGANIZATION_ADMIN_ALLOWED_API_KEY_SCOPES,
  USER_PERMISSIONS,
  WORKSPACE_ADMIN_ALLOWED_API_KEY_SCOPES,
  WORKSPACE_PERMISSIONS,
  type ApiKeyScope,
} from "@repo/constants";
import { ForbiddenErrorException } from "../exceptions/forbidden.js";
import type { WorkspaceAccess } from "../types/access-control.js";

const allApiKeyScopes = new Set<ApiKeyScope>(Object.values(API_KEY_SCOPES));
const organizationAdminScopes = new Set<ApiKeyScope>(
  ORGANIZATION_ADMIN_ALLOWED_API_KEY_SCOPES,
);
const workspaceAdminScopes = new Set<ApiKeyScope>(
  WORKSPACE_ADMIN_ALLOWED_API_KEY_SCOPES,
);

/** API Key 발급자의 역할에 따라 요청 가능한 scope를 제한합니다. */
export class ApiKeyIssuancePolicy {
  /** 워크스페이스 API Key에 요청한 scope를 발급할 수 있는지 확인합니다. */
  assertWorkspaceScopes(
    access: WorkspaceAccess,
    requestedScopes: ApiKeyScope[],
  ): void {
    if (access.organizationRole === USER_PERMISSIONS.OWNER) {
      this.assertScopesAllowed(requestedScopes, allApiKeyScopes);
      return;
    }
    if (access.organizationRole === USER_PERMISSIONS.ADMIN) {
      this.assertScopesAllowed(requestedScopes, organizationAdminScopes);
      return;
    }
    if (access.workspaceRole === WORKSPACE_PERMISSIONS.ADMIN) {
      this.assertScopesAllowed(requestedScopes, workspaceAdminScopes);
      return;
    }
    this.throwScopeNotAllowed();
  }

  private assertScopesAllowed(
    requestedScopes: ApiKeyScope[],
    allowedScopes: ReadonlySet<ApiKeyScope>,
  ): void {
    if (
      requestedScopes.length === 0 ||
      requestedScopes.some((scope) => !allowedScopes.has(scope))
    ) {
      this.throwScopeNotAllowed();
    }
  }

  private throwScopeNotAllowed(): never {
    throw new ForbiddenErrorException(ERROR_CODES.API_KEY_SCOPE_NOT_ALLOWED);
  }
}

/** 애플리케이션에서 공유하는 API Key 발급 정책입니다. */
export const apiKeyIssuancePolicy = new ApiKeyIssuancePolicy();
