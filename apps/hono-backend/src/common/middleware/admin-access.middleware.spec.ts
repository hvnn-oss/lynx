import { ERROR_CODES } from "@repo/constants";
import { Hono } from "hono";
import { AppDataSource } from "../../provider/database/typeorm-config.js";
import type { AppEnv } from "../types/app-env.js";
import { requireAdminAccess } from "./admin-access.middleware.js";

describe("admin access middleware", () => {
  afterEach(() => jest.restoreAllMocks());

  function createApp() {
    const app = new Hono<AppEnv>();
    app.use("*", async (context, next) => {
      context.set("currentUserId", "user-1");
      await next();
    });
    app.use("*", requireAdminAccess);
    app.get("/test", (context) => context.text("ok"));
    return app;
  }

  it("활성 관리자에게 초대 관리 API를 허용한다", async () => {
    const findOne = jest.fn().mockResolvedValue({ id: "admin-1" });
    jest
      .spyOn(AppDataSource, "getRepository")
      .mockReturnValue({ findOne } as never);

    const response = await createApp().request("/test");

    expect(response.status).toBe(200);
    expect(findOne).toHaveBeenCalledWith({
      where: { user: { id: "user-1" }, isActive: true },
    });
  });

  it("일반 사용자의 초대 관리 API 요청을 거부한다", async () => {
    jest.spyOn(AppDataSource, "getRepository").mockReturnValue({
      findOne: jest.fn().mockResolvedValue(null),
    } as never);

    const response = await createApp().request("/test");

    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toContain(
      ERROR_CODES.ADMIN_ACCESS_REQUIRED,
    );
  });
});
