import { organizationContract } from "@repo/contract";
import { Hono } from "hono";
import type { AppEnv } from "../../common/types/app-env.js";
import { createOrgHandlers } from "./organization.handler.js";
import { orgService } from "./organization.service.js";
import { accessInvitationService } from "../access-invitation/access-invitation.service.js";

jest.mock("./organization.service.js", () => ({
  orgService: {
    listOrganizations: jest.fn(),
    createOrganization: jest.fn(),
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    uploadProfileImage: jest.fn(),
  },
}));
jest.mock("../access-invitation/access-invitation.service.js", () => ({
  accessInvitationService: {
    createTeamInvitation: jest.fn(),
    listTeamInvitations: jest.fn(),
    revokeTeamInvitation: jest.fn(),
  },
}));

const mockedService = jest.mocked(orgService);
const mockedInvitationService = jest.mocked(accessInvitationService);
const organizationId = "00000000-0000-4000-8000-000000000001";

function createApp() {
  const app = new Hono<AppEnv>();
  const handlers = createOrgHandlers();
  app.use("*", async (c, next) => {
    c.set("currentUserId", "user-1");
    await next();
  });
  app.on(
    organizationContract.list.method,
    organizationContract.list.path,
    ...handlers.listOrganizations,
  );
  app.on(
    organizationContract.updateProfile.method,
    organizationContract.updateProfile.path,
    ...handlers.updateProfile,
  );
  app.on(
    organizationContract.uploadProfileImage.method,
    organizationContract.uploadProfileImage.path,
    ...handlers.uploadProfileImage,
  );
  app.on(
    organizationContract.createInvitation.method,
    organizationContract.createInvitation.path,
    ...handlers.createInvitation,
  );
  app.on(
    organizationContract.listInvitations.method,
    organizationContract.listInvitations.path,
    ...handlers.listInvitations,
  );
  app.on(
    organizationContract.revokeInvitation.method,
    organizationContract.revokeInvitation.path,
    ...handlers.revokeInvitation,
  );
  return app;
}

describe("organization profile HTTP handlers", () => {
  it("현재 사용자의 조직 목록을 반환한다", async () => {
    mockedService.listOrganizations.mockResolvedValue({
      items: [
        {
          id: organizationId,
          name: "Lynx",
          profileImageUrl: null,
          role: "OWNER",
        },
      ],
    });

    const response = await createApp().request("/list");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [
        {
          id: organizationId,
          name: "Lynx",
          profileImageUrl: null,
          role: "OWNER",
        },
      ],
    });
    expect(mockedService.listOrganizations).toHaveBeenCalledWith("user-1");
  });

  it("검증된 조직 이름 변경을 서비스에 전달한다", async () => {
    mockedService.updateProfile.mockResolvedValue({
      id: organizationId,
      name: "Updated Lynx",
      profileImageUrl: null,
      role: "OWNER",
    });

    const response = await createApp().request(`/${organizationId}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated Lynx" }),
    });

    expect(response.status).toBe(200);
    expect(mockedService.updateProfile).toHaveBeenCalledWith({
      userId: "user-1",
      organizationId,
      profile: { name: "Updated Lynx" },
    });
  });

  it("조직 이미지의 raw 본문을 서비스에 전달한다", async () => {
    mockedService.uploadProfileImage.mockResolvedValue({
      profileImageUrl: "https://images.example.com/organization",
    });

    const response = await createApp().request(
      `/${organizationId}/profile/image`,
      {
        method: "PUT",
        headers: { "Content-Type": "image/webp" },
        body: new Uint8Array([4, 5, 6]),
      },
    );

    expect(response.status).toBe(200);
    expect(mockedService.uploadProfileImage).toHaveBeenCalledWith({
      userId: "user-1",
      organizationId,
      upload: {
        contentType: "image/webp",
        bytes: new Uint8Array([4, 5, 6]),
      },
    });
  });

  it("조직 멤버 초대 요청을 현재 사용자와 함께 전달한다", async () => {
    mockedInvitationService.createTeamInvitation.mockResolvedValue({
      id: "76c4232f-b842-4b02-9192-00659856591b",
      email: "member@example.com",
      role: "MEMBER",
      status: "PENDING",
      invitationUrl:
        "http://localhost:3000/invite?code=82d26b85-316a-42a8-94f7-30b63c74e52c",
      expiresAt: "2026-08-05T00:00:00.000Z",
      acceptedAt: null,
      createdAt: "2026-07-29T00:00:00.000Z",
    });

    const response = await createApp().request(
      `/${organizationId}/invitations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "member@example.com",
          role: "MEMBER",
        }),
      },
    );

    expect(response.status).toBe(201);
    expect(
      mockedInvitationService.createTeamInvitation,
    ).toHaveBeenCalledWith("user-1", organizationId, {
      email: "member@example.com",
      role: "MEMBER",
      expiresInHours: 168,
    });
  });
});
