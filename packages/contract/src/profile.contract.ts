import {
  ChangePasswordSchema,
  ProfileImageResponseSchema,
  SuccessResponseSchema,
  UpdateUserProfileSchema,
  UserProfileResponseSchema,
} from "@repo/dto";
import { defineEndpoint } from "./util/endpoint.js";

export const PROFILE_BASE_PATH = "/profile";

export const profileContract = {
  basePath: PROFILE_BASE_PATH,
  get: defineEndpoint({
    method: "GET",
    path: "/",
    request: null,
    response: UserProfileResponseSchema,
  }),
  update: defineEndpoint({
    method: "PATCH",
    path: "/",
    request: UpdateUserProfileSchema,
    response: UserProfileResponseSchema,
  }),
  changePassword: defineEndpoint({
    method: "POST",
    path: "/password",
    request: ChangePasswordSchema,
    response: SuccessResponseSchema,
  }),
  uploadImage: defineEndpoint({
    method: "PUT",
    path: "/image",
    request: null,
    response: ProfileImageResponseSchema,
  }),
} as const;
