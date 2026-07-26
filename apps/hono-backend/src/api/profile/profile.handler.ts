import { profileContract } from "@repo/contract";
import { createFactory } from "hono/factory";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../../common/types/app-env.js";
import { readImageUpload } from "../../common/util/read-image-upload.js";
import { profileService } from "./profile.service.js";

const factory = createFactory<AppEnv>();

/** 사용자 프로필 API의 요청 처리기를 구성합니다. */
export function createProfileHandlers() {
  const getProfile = factory.createHandlers(async (c) => {
    const profile = await profileService.getProfile(c.get("currentUserId"));
    return c.json(profileContract.get.response.parse(profile));
  });

  const updateProfile = factory.createHandlers(
    zValidator("json", profileContract.update.request),
    async (c) => {
      const profile = await profileService.updateProfile(
        c.get("currentUserId"),
        c.req.valid("json"),
      );
      return c.json(profileContract.update.response.parse(profile));
    },
  );

  const changePassword = factory.createHandlers(
    zValidator("json", profileContract.changePassword.request),
    async (c) =>
      c.json(
        profileContract.changePassword.response.parse(
          await profileService.changePassword(
            c.get("currentUserId"),
            c.req.valid("json"),
          ),
        ),
      ),
  );

  const uploadImage = factory.createHandlers(async (c) => {
    const upload = await readImageUpload(c);
    const image = await profileService.uploadImage(
      c.get("currentUserId"),
      upload,
    );
    return c.json(profileContract.uploadImage.response.parse(image));
  });

  return { getProfile, updateProfile, changePassword, uploadImage };
}
