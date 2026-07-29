import { issuesContract } from "@repo/contract";
import { Hono } from "hono";
import { requireAccessToken } from "../../common/middleware/access-token.middleware.js";
import { requireProductAccess } from "../../common/middleware/product-access.middleware.js";
import type { AppEnv } from "../../common/types/app-env.js";
import { createIssueHandlers } from "./issues.handler.js";

const handlers = createIssueHandlers();

/** 로그인 사용자의 워크스페이스 이슈 관리 API를 연결합니다. */
export const issuesRouter = new Hono<AppEnv>();

issuesRouter.use("*", requireAccessToken);
issuesRouter.use("*", requireProductAccess);

issuesRouter.on(
  issuesContract.getIssueRecords.method,
  issuesContract.getIssueRecords.path,
  ...handlers.getIssueRecords,
);

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
  issuesContract.getActivities.method,
  issuesContract.getActivities.path,
  ...handlers.getActivities,
);
issuesRouter.on(
  issuesContract.createComment.method,
  issuesContract.createComment.path,
  ...handlers.createComment,
);
issuesRouter.on(
  issuesContract.updateComment.method,
  issuesContract.updateComment.path,
  ...handlers.updateComment,
);
issuesRouter.on(
  issuesContract.deleteComment.method,
  issuesContract.deleteComment.path,
  ...handlers.deleteComment,
);
issuesRouter.on(
  issuesContract.getAssignees.method,
  issuesContract.getAssignees.path,
  ...handlers.getAssignees,
);
issuesRouter.on(
  issuesContract.updateAssignees.method,
  issuesContract.updateAssignees.path,
  ...handlers.updateAssignees,
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
