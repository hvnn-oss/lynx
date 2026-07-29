import { bootstrapContract } from "@repo/contract";
import { Hono } from "hono";
import type { AppEnv } from "../../common/types/app-env.js";
import { createBootstrapHandlers } from "./bootstrap.handler.js";
import { bootstrapService } from "./bootstrap.service.js";

jest.mock("./bootstrap.service.js", () => ({
  bootstrapService: {
    getDashboardContext: jest.fn(),
  },
}));

const mockedService = jest.mocked(bootstrapService);

describe("bootstrap HTTP handlers", () => {
  it("인증 사용자의 대시보드 컨텍스트를 반환한다", async () => {
    const app = new Hono<AppEnv>();
    const handlers = createBootstrapHandlers();
    app.use("*", async (context, next) => {
      context.set("currentUserId", "user-1");
      await next();
    });
    app.on(
      bootstrapContract.get.method,
      bootstrapContract.get.path,
      ...handlers.getDashboardContext,
    );
    mockedService.getDashboardContext.mockResolvedValue({
      user: {
        id: "00000000-0000-4000-8000-000000000001",
        email: "user@example.com",
        name: "Lynx User",
        profileImageUrl: null,
      },
      access: {
        mode: "INVITE_ONLY",
        status: "ACTIVE",
        canUseProduct: true,
        canCreateWorkspace: true,
        reason: null,
      },
      organizations: [],
      workspaces: [],
    });

    const response = await app.request("/");

    expect(response.status).toBe(200);
    expect(mockedService.getDashboardContext).toHaveBeenCalledWith("user-1");
  });
});
