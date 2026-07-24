import { API_KEY_SCOPES } from "@repo/constants";
import { openAPIContract } from "@repo/contract";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createWorkspaceApiKeyMiddleware } from "../../common/middleware/workspace-api-key.middleware.js";
import type { AppEnv } from "../../common/types/app-env.js";
import { createIssueRecordHandlers } from "./issue-record.handler.js";

const handlers = createIssueRecordHandlers();

/** SDK 탐지 결과를 비동기 검토 대상으로 접수하는 OpenAPI 라우터입니다. */
export const issueRecordRouter = new Hono<AppEnv>();

// 원본 근거 payload의 과도한 유입을 막고 이벤트 쓰기 권한을 요구합니다.
issueRecordRouter.on(
  openAPIContract.createIssueRecord.method,
  openAPIContract.createIssueRecord.path,
  bodyLimit({ maxSize: 256 * 1024 }),
  createWorkspaceApiKeyMiddleware([API_KEY_SCOPES.EVENTS_WRITE]),
  ...handlers.create,
);
