import {
  authContract,
  dashboardContract,
  issuesContract,
  openAPIContract,
  organizationContract,
  profileContract,
  firewallPolicyContract,
  firewallApprovalContract,
  promptContract,
  workspaceContract,
  systemContract,
} from "@repo/contract";
import { Hono } from "hono";
import { requestId } from "hono/request-id";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { authRoute } from "./api/auth/auth.router.js";
import { openAPIRouter } from "./api/openapi/openapi.router.js";
import { orgRouter } from "./api/organization/organization.router.js";
import { workspaceRouter } from "./api/workspace/workspace.router.js";
import { createPublicErrorResponse } from "./common/errors/error-response.js";
import { requestLoggerMiddleware } from "./common/middleware/request-logger.middleware.js";
import type { AppEnv } from "./common/types/app-env.js";
import { issuesRouter } from "./api/issues/issues.router.js";
import { profileRouter } from "./api/profile/profile.router.js";
import { firewallPolicyRouter } from "./api/firewall-policy/firewall-policy.router.js";
import { firewallApprovalRouter } from "./api/firewall-approval/firewall-approval.router.js";
import { promptRouter } from "./api/prompt/prompt.router.js";
import { openAPIDocument } from "./api/openapi/openapi-document.js";
import { dashboardRouter } from "./api/dashboard/dashboard.router.js";
import { PublicErrorResponseSchema } from "@repo/dto";

/**
 * 공통 미들웨어와 기능별 라우터를 연결한 Hono 애플리케이션입니다.
 *
 * 인증 방식이 다른 관리 API와 SDK OpenAPI를 각각의 계약 base path에
 * 연결하고, 예외와 404 응답을 일관된 공개 형식으로 변환합니다.
 */
export const app = new Hono<AppEnv>();

// 모든 요청에 추적 ID와 요청 전용 로거를 설정합니다.
app.use("*", requestId());
app.use("*", requestLoggerMiddleware);

/** 서버 프로세스가 요청을 처리할 수 있는지 확인합니다. */
app.on(systemContract.health.method, systemContract.health.path, (c) =>
  c.json(systemContract.health.response.parse({ status: "ok" })),
);

/** Public machine-readable contract for SDK generation and API tooling. */
app.on(
  systemContract.openApiDocument.method,
  systemContract.openApiDocument.path,
  (c) => {
  c.header("Cache-Control", "public, max-age=300");
    return c.json(
      systemContract.openApiDocument.response.parse(openAPIDocument),
    );
  },
);

// 각 도메인 라우터는 공유 계약에 정의된 기본 경로에 연결합니다.
app.route(authContract.basePath, authRoute);
app.route(organizationContract.basePath, orgRouter);
app.route(profileContract.basePath, profileRouter);
app.route(workspaceContract.basePath, workspaceRouter);
app.route(dashboardContract.basePath, dashboardRouter);
app.route(openAPIContract.basePath, openAPIRouter);
app.route(issuesContract.basePath, issuesRouter);
app.route(firewallPolicyContract.basePath, firewallPolicyRouter);
app.route(firewallApprovalContract.basePath, firewallApprovalRouter);
app.route(promptContract.basePath, promptRouter);

// 내부 예외를 스택 없이 안전한 공개 오류 응답으로 변환합니다.
app.onError((error, c) => {
  c.get("logger")?.error(
    {
      event: "http.request.unhandled_error",
      err: error,
    },
    "unhandled request error",
  );
  const { status, ...body } = createPublicErrorResponse(
    error,
    c.get("requestId"),
  );

  return c.json(
    PublicErrorResponseSchema.parse(body),
    status as ContentfulStatusCode,
  );
});

// 어떤 라우터와도 일치하지 않은 요청은 공통 404 형식으로 반환합니다.
app.notFound((c) =>
  c.json(
    PublicErrorResponseSchema.parse({
      code: "NOT_FOUND",
      message: "The requested resource was not found.",
      requestId: c.get("requestId"),
    }),
    404,
  ),
);
