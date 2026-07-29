import { ERROR_CODES } from "@repo/constants";
import { Hono } from "hono";
import { productAccessService } from "../access-control/product-access.service.js";
import { ForbiddenErrorException } from "../exceptions/forbidden.js";
import type { AppEnv } from "../types/app-env.js";
import { requireProductAccess } from "./product-access.middleware.js";

describe("product access middleware", () => {
  afterEach(() => jest.restoreAllMocks());

  function createApp() {
    const app = new Hono<AppEnv>();
    app.use("*", async (context, next) => {
      context.set("currentUserId", "user-1");
      await next();
    });
    app.use("*", requireProductAccess);
    app.get("/test", (context) => context.text("ok"));
    return app;
  }

  it("승인된 사용자의 요청을 다음 handler로 전달한다", async () => {
    jest
      .spyOn(productAccessService, "assertUserAccess")
      .mockResolvedValue(undefined);

    const response = await createApp().request("/test");

    expect(response.status).toBe(200);
    expect(productAccessService.assertUserAccess).toHaveBeenCalledWith(
      "user-1",
    );
  });

  it("승인되지 않은 사용자의 관리 API 요청을 403으로 차단한다", async () => {
    jest
      .spyOn(productAccessService, "assertUserAccess")
      .mockRejectedValue(
        new ForbiddenErrorException(ERROR_CODES.PRODUCT_ACCESS_NOT_GRANTED),
      );

    const response = await createApp().request("/test");

    expect(response.status).toBe(403);
  });
});
