import { ERROR_CODES } from "@repo/constants";
import { AdminUserEntity } from "@repo/database";
import { createMiddleware } from "hono/factory";
import { AppDataSource } from "../../provider/database/typeorm-config.js";
import { ForbiddenErrorException } from "../exceptions/forbidden.js";
import type { AppEnv } from "../types/app-env.js";

/** 활성 Lynx 관리자만 파일럿 초대를 관리할 수 있도록 제한합니다. */
export const requireAdminAccess = createMiddleware<AppEnv>(
  async (context, next) => {
    const admin = await AppDataSource.getRepository(AdminUserEntity).findOne({
      where: {
        user: { id: context.get("currentUserId") },
        isActive: true,
      },
    });
    if (!admin) {
      throw new ForbiddenErrorException(ERROR_CODES.ADMIN_ACCESS_REQUIRED);
    }
    context.set("currentAdminRole", admin.role);
    await next();
  },
);
