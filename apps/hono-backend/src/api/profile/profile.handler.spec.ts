import { profileContract } from "@repo/contract";
import { Hono } from "hono";
import type { AppEnv } from "../../common/types/app-env.js";
import { createProfileHandlers } from "./profile.handler.js";
import { profileService } from "./profile.service.js";

jest.mock("./profile.service.js", () => ({
  profileService: {
    getProfile: jest.fn(),
    uploadImage: jest.fn(),
  },
}));

const mockedService = jest.mocked(profileService);

function createApp() {
  const app = new Hono<AppEnv>();
  const handlers = createProfileHandlers();
  app.use("*", async (c, next) => {
    c.set("currentUserId", "user-1");
    await next();
  });
  app.on(
    profileContract.get.method,
    profileContract.get.path,
    ...handlers.getProfile,
  );
  app.on(
    profileContract.uploadImage.method,
    profileContract.uploadImage.path,
    ...handlers.uploadImage,
  );
  return app;
}

describe("profile HTTP handlers", () => {
  it("현재 사용자의 프로필을 조회한다", async () => {
    mockedService.getProfile.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
      email: "user@example.com",
      name: "Lynx User",
      profileImageUrl: null,
    });

    const response = await createApp().request("/");

    expect(response.status).toBe(200);
    expect(mockedService.getProfile).toHaveBeenCalledWith("user-1");
  });

  it("raw 이미지 본문과 MIME 타입을 서비스에 전달한다", async () => {
    mockedService.uploadImage.mockResolvedValue({
      profileImageUrl: "https://images.example.com/profile",
    });

    const response = await createApp().request("/image", {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: new Uint8Array([1, 2, 3]),
    });

    expect(response.status).toBe(200);
    expect(mockedService.uploadImage).toHaveBeenCalledWith("user-1", {
      contentType: "image/png",
      bytes: new Uint8Array([1, 2, 3]),
    });
  });
});
