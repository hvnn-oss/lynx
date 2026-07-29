import { createMiddleware } from "hono/factory";
import { productAccessService } from "../access-control/product-access.service.js";
import type { AppEnv } from "../types/app-env.js";

/** Access Token 인증 뒤 파일럿 또는 공개 제품 접근 권한을 확인합니다. */
export const requireProductAccess = createMiddleware<AppEnv>(
  async (context, next) => {
    await productAccessService.assertUserAccess(context.get("currentUserId"));
    await next();
  },
);
