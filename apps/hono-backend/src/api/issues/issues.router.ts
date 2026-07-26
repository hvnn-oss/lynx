import { issuesContract } from "@repo/contract";
import { Hono } from "hono";
import { requireAccessToken } from "../../common/middleware/access-token.middleware.js";
import type { AppEnv } from "../../common/types/app-env.js";
import { createIssueHandlers } from "./issues.handler.js";

const handlers = createIssueHandlers();

/** 로그인 사용자의 워크스페이스 이슈 관리 API를 연결합니다. */
export const issuesRouter = new Hono<AppEnv>();

issuesRouter.use("*", requireAccessToken);

// summary를 issueId 동적 경로보다 먼저 등록해 경로 의미를 명확히 유지합니다.
issuesRouter.on(
  issuesContract.getSummary.method,
  issuesContract.getSummary.path,
  ...handlers.getSummary,
);
issuesRouter.on(
  issuesContract.getIssues.method,
  issuesContract.getIssues.path,
  ...handlers.getIssues,
);
issuesRouter.on(
  issuesContract.getOccurrences.method,
  issuesContract.getOccurrences.path,
  ...handlers.getOccurrences,
);
issuesRouter.on(
  issuesContract.getEvaluations.method,
  issuesContract.getEvaluations.path,
  ...handlers.getEvaluations,
);
issuesRouter.on(
  issuesContract.updateStatus.method,
  issuesContract.updateStatus.path,
  ...handlers.updateStatus,
);
issuesRouter.on(
  issuesContract.getIssue.method,
  issuesContract.getIssue.path,
  ...handlers.getIssue,
);
