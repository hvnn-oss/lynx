import {
  CreateEmailVerificationResponseSchema,
  CreateEmailVerificationSchema,
  LoginResponseSchema,
  LoginSchema,
  RefreshTokenResponseSchema,
  SignUpResponseSchema,
  SignUpSchema,
  SuccessResponseSchema,
  VerifyEmailTokenResponseSchema,
  VerifyEmailTokenSchema,
  SignupPolicyResponseSchema,
} from "@repo/dto";
import { defineEndpoint } from "./util/endpoint.js";

const AUTH_BASE_PATH = "/auth" as const;

export const authContract = {
  basePath: AUTH_BASE_PATH,
  signupPolicy: defineEndpoint({
    method: "GET",
    path: "/signup/policy",
    request: null,
    response: SignupPolicyResponseSchema,
  }),
  ssoLogin: defineEndpoint({
    method: "GET",
    path: "/sso/login",
    request: CreateEmailVerificationSchema.pick({ email: true }),
    response: null,
  }),
  createEmailVerification: defineEndpoint({
    method: "POST",
    path: "/signup/create-verify",
    request: CreateEmailVerificationSchema,
    response: CreateEmailVerificationResponseSchema,
  }),
  verifyEmailToken: defineEndpoint({
    method: "POST",
    path: "/signup/verify",
    request: VerifyEmailTokenSchema,
    response: VerifyEmailTokenResponseSchema,
  }),
  signUp: defineEndpoint({
    method: "POST",
    path: "/signup",
    request: SignUpSchema,
    response: SignUpResponseSchema,
  }),
  login: defineEndpoint({
    method: "POST",
    path: "/login",
    request: LoginSchema,
    response: LoginResponseSchema,
  }),
  refresh: defineEndpoint({
    method: "POST",
    path: "/refresh",
    request: SuccessResponseSchema.pick({}),
    response: RefreshTokenResponseSchema,
  }),
  logout: defineEndpoint({
    method: "POST",
    path: "/logout",
    request: SuccessResponseSchema.pick({}),
    response: SuccessResponseSchema,
  }),
} as const;

type AuthEndpoint = (typeof authContract)[Exclude<
  keyof typeof authContract,
  "basePath"
>];

export function getAuthEndpointPath(endpoint: AuthEndpoint) {
  return `${authContract.basePath}${endpoint.path}` as const;
}
