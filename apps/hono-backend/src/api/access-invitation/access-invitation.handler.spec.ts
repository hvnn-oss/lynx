import { accessContract } from "@repo/contract";
import { Hono } from "hono";
import type { AppEnv } from "../../common/types/app-env.js";
import { createAccessInvitationHandlers } from "./access-invitation.handler.js";
import { accessInvitationService } from "./access-invitation.service.js";

jest.mock("./access-invitation.service.js", () => ({
  accessInvitationService: {
    create: jest.fn(),
    list: jest.fn(),
    revoke: jest.fn(),
  },
}));

const mockedService = jest.mocked(accessInvitationService);

function createApp() {
  const app = new Hono<AppEnv>();
  const handlers = createAccessInvitationHandlers();
  app.use("*", async (context, next) => {
    context.set("currentUserId", "admin-1");
    await next();
  });
  app.on(
    accessContract.createInvitation.method,
    accessContract.createInvitation.path,
    ...handlers.create,
  );
  app.on(
    accessContract.listInvitations.method,
    accessContract.listInvitations.path,
    ...handlers.list,
  );
  app.on(
    accessContract.revokeInvitation.method,
    accessContract.revokeInvitation.path,
    ...handlers.revoke,
  );
  return app;
}

describe("access invitation HTTP handlers", () => {
  beforeEach(() => jest.clearAllMocks());

  it("검증된 이메일과 만료 시간을 관리자 서비스에 전달한다", async () => {
    mockedService.create.mockResolvedValue({
      id: "0782d59b-d50a-4f2e-93c2-2bd7cf4ec94f",
      email: "pilot@example.com",
      status: "PENDING",
      expiresAt: "2026-08-01T00:00:00.000Z",
      acceptedAt: null,
      createdAt: "2026-07-29T00:00:00.000Z",
    });

    const response = await createApp().request("/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "pilot@example.com",
        expiresInHours: 72,
      }),
    });

    expect(response.status).toBe(201);
    expect(mockedService.create).toHaveBeenCalledWith("admin-1", {
      email: "pilot@example.com",
      expiresInHours: 72,
    });
  });

  it("목록 query의 상태와 pagination 값을 전달한다", async () => {
    mockedService.list.mockResolvedValue({ items: [], nextCursor: null });

    const response = await createApp().request(
      "/invitations?status=PENDING&limit=10",
    );

    expect(response.status).toBe(200);
    expect(mockedService.list).toHaveBeenCalledWith({
      status: "PENDING",
      limit: 10,
    });
  });

  it("초대 ID를 사용해 대기 초대를 취소한다", async () => {
    mockedService.revoke.mockResolvedValue({ success: true });
    const invitationId = "0782d59b-d50a-4f2e-93c2-2bd7cf4ec94f";

    const response = await createApp().request(`/invitations/${invitationId}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    expect(mockedService.revoke).toHaveBeenCalledWith(invitationId);
  });
});
