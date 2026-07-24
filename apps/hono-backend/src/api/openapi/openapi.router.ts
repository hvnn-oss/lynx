import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { API_KEY_SCOPES } from "@repo/constants";
import { openAPIContract } from "@repo/contract";
import type { AppEnv } from "../../common/types/app-env.js";
import { createWorkspaceApiKeyMiddleware } from "../../common/middleware/workspace-api-key.middleware.js";
import { openApiRateLimitMiddleware } from "../../common/middleware/openapi-rate-limit.middleware.js";
import { createOpenAPIEventHandlers } from "./event.handler.js";
import { issueRecordRouter } from "./issue-record/issue-record.router.js";
import { runtimeConfigRouter } from "./runtime-config/runtime-config.router.js";

/**
 * SDK와 외부 클라이언트가 사용하는 `/openapi/v1` 하위 라우터입니다.
 *
 * 각 엔드포인트는 용도에 맞는 API 키 권한과 워크스페이스 경계를
 * 적용한 뒤 서비스 계층으로 요청을 전달합니다.
 */
export const openAPIRouter = new Hono<AppEnv>();

const handlers = createOpenAPIEventHandlers();

// 이슈 접수와 런타임 설정도 동일한 OpenAPI 인증 경계를 사용합니다.
openAPIRouter.route("/", issueRecordRouter);
openAPIRouter.route("/", runtimeConfigRouter);

// 이벤트 배치는 비정상적으로 큰 요청이 저장 계층에 도달하지 않도록 제한합니다.
openAPIRouter.on(
  openAPIContract.ingestEvents.method,
  openAPIContract.ingestEvents.path,
  bodyLimit({ maxSize: 1024 * 1024 }),
  createWorkspaceApiKeyMiddleware([API_KEY_SCOPES.EVENTS_WRITE]),
  openApiRateLimitMiddleware,
  ...handlers.ingestBatch,
);
/** Run 목록 조회에는 사용량 읽기 권한이 필요합니다. */
openAPIRouter.on(
  openAPIContract.listRuns.method,
  openAPIContract.listRuns.path,
  createWorkspaceApiKeyMiddleware([API_KEY_SCOPES.USAGE_READ]),
  openApiRateLimitMiddleware,
  ...handlers.listRuns,
);
/** Run 상세와 이벤트 타임라인 조회에는 사용량 읽기 권한이 필요합니다. */
openAPIRouter.on(
  openAPIContract.getRun.method,
  openAPIContract.getRun.path,
  createWorkspaceApiKeyMiddleware([API_KEY_SCOPES.USAGE_READ]),
  openApiRateLimitMiddleware,
  ...handlers.getRun,
);
/** 큰 Run의 Event 타임라인을 제한된 페이지로 조회합니다. */
openAPIRouter.on(
  openAPIContract.listRunEvents.method,
  openAPIContract.listRunEvents.path,
  createWorkspaceApiKeyMiddleware([API_KEY_SCOPES.USAGE_READ]),
  openApiRateLimitMiddleware,
  ...handlers.listRunEvents,
);
