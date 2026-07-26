import { organizationContract } from "@repo/contract";
import { Hono } from "hono";
import type { AppEnv } from "../../common/types/app-env.js";
import { createOrgHandlers } from "./organization.handler.js";
import { orgService } from "./organization.service.js";

jest.mock("./organization.service.js", () => ({
  orgService: {
    createOrganization: jest.fn(),
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    uploadProfileImage: jest.fn(),
  },
}));

const mockedService = jest.mocked(orgService);
const organizationId = "00000000-0000-4000-8000-000000000001";

function createApp() {
  const app = new Hono<AppEnv>();
  const handlers = createOrgHandlers();
  app.use("*", async (c, next) => {
    c.set("currentUserId", "user-1");
    await next();
  });
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
  return app;
}

describe("organization profile HTTP handlers", () => {
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
});
