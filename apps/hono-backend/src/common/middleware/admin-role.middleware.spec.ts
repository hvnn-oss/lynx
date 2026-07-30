import { ADMIN_ROLES } from "@repo/constants";
import { Hono } from "hono";
import type { AppEnv } from "../types/app-env.js";
import { requireAdminRole } from "./admin-role.middleware.js";

describe("requireAdminRole", () => {
  it("뷰어의 변경 요청을 거절하고 일반 관리자는 통과시킨다", async () => {
    const createApp = (
      role: (typeof ADMIN_ROLES)[keyof typeof ADMIN_ROLES],
    ) => {
      const app = new Hono<AppEnv>();
      app.use("*", async (context, next) => {
        context.set("currentAdminRole", role);
        await next();
      });
      app.post("/mutation", requireAdminRole(ADMIN_ROLES.ADMIN), (context) =>
        context.json({ success: true }),
      );
      return app;
    };

    await expect(
      createApp(ADMIN_ROLES.VIEWER).request("/mutation", {
        method: "POST",
      }),
    ).resolves.toMatchObject({ status: 403 });
    await expect(
      createApp(ADMIN_ROLES.ADMIN).request("/mutation", {
        method: "POST",
      }),
    ).resolves.toMatchObject({ status: 200 });
  });
});
