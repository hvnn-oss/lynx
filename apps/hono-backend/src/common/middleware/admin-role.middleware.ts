import { ERROR_CODES, type AdminRole } from "@repo/constants";
import { createMiddleware } from "hono/factory";
import { hasMinimumAdminRole } from "../access-control/admin-role.policy.js";
import { ForbiddenErrorException } from "../exceptions/forbidden.js";
import type { AppEnv } from "../types/app-env.js";

/**
 * 관리자 읽기 권한과 별도로 변경 작업에 필요한 최소 역할을 검사합니다.
 * 반드시 requireAdminAccess 뒤에 등록해야 합니다.
 */
export function requireAdminRole(minimumRole: AdminRole) {
  return createMiddleware<AppEnv>(async (context, next) => {
    if (!hasMinimumAdminRole(context.get("currentAdminRole"), minimumRole)) {
      throw new ForbiddenErrorException(ERROR_CODES.ADMIN_ROLE_REQUIRED);
    }
    await next();
  });
}
