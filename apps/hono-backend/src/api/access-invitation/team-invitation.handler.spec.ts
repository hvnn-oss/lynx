import { teamInvitationContract } from "@repo/contract";
import { Hono } from "hono";
import type { AppEnv } from "../../common/types/app-env.js";
import { accessInvitationService } from "./access-invitation.service.js";
import { createTeamInvitationHandlers } from "./team-invitation.handler.js";

jest.mock("./access-invitation.service.js", () => ({
  accessInvitationService: {
    getTeamInvitation: jest.fn(),
    acceptTeamInvitation: jest.fn(),
  },
}));

const mockedService = jest.mocked(accessInvitationService);
const code = "82d26b85-316a-42a8-94f7-30b63c74e52c";
const organizationId = "4511e0fc-7ca8-478e-8ef4-cc66d557852f";

function createApp() {
  const app = new Hono<AppEnv>();
  const handlers = createTeamInvitationHandlers();
  app.use("*", async (context, next) => {
    context.set("currentUserId", "user-1");
    await next();
  });
  app.on(
    teamInvitationContract.get.method,
    teamInvitationContract.get.path,
    ...handlers.get,
  );
  app.on(
    teamInvitationContract.accept.method,
    teamInvitationContract.accept.path,
    ...handlers.accept,
  );
  return app;
}

describe("team invitation HTTP handlers", () => {
  it("초대 코드로 공개 조직 정보를 조회한다", async () => {
    mockedService.getTeamInvitation.mockResolvedValue({
      organizationId,
      organizationName: "Acme",
      emailHint: "me****@example.com",
      role: "MEMBER",
      status: "PENDING",
      expiresAt: "2026-08-01T00:00:00.000Z",
    });

    const response = await createApp().request(`/?code=${code}`);

    expect(response.status).toBe(200);
    expect(mockedService.getTeamInvitation).toHaveBeenCalledWith(code);
    await expect(response.json()).resolves.toMatchObject({
      organizationId,
      organizationName: "Acme",
    });
  });

  it("로그인 사용자의 초대 수락 요청을 서비스에 전달한다", async () => {
    mockedService.acceptTeamInvitation.mockResolvedValue({
      organizationId,
      organizationName: "Acme",
      redirectTo: "/dashboard",
    });

    const response = await createApp().request("/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    expect(response.status).toBe(200);
    expect(mockedService.acceptTeamInvitation).toHaveBeenCalledWith(
      "user-1",
      code,
    );
  });
});
