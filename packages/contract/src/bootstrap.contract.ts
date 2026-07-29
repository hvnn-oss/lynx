import { DashboardBootstrapResponseSchema } from "@repo/dto";
import { defineEndpoint } from "./util/endpoint.js";

export const BOOTSTRAP_BASE_PATH = "/bootstrap";

/** 대시보드 초기 로드에 필요한 인증 사용자 컨텍스트 계약입니다. */
export const bootstrapContract = {
  basePath: BOOTSTRAP_BASE_PATH,
  get: defineEndpoint({
    method: "GET",
    path: "/",
    request: null,
    response: DashboardBootstrapResponseSchema,
  }),
} as const;
