import { zValidator } from "@hono/zod-validator";
import { openAPIContract } from "@repo/contract";
import type { IssueRecordAcceptedResponseDto } from "@repo/dto";
import { createFactory } from "hono/factory";
import type { AppEnv } from "../../common/types/app-env.js";
import { issueRecordService } from "./issue-record.service.js";

const factory = createFactory<AppEnv>();

/**
 * SDK 이슈 기록 요청을 검증하고 접수하는 핸들러를 생성합니다.
 *
 * 실제 이슈 판정은 이 요청에서 수행하지 않으며, 저장된 record가 후속
 * 평가 작업의 입력이 됩니다.
 */
export function createIssueRecordHandlers() {
  /** 원본 탐지 record를 저장하고 비동기 처리 상태를 반환합니다. */
  const create = factory.createHandlers(
    zValidator("json", openAPIContract.createIssueRecord.request),
    async (c) => {
      const response = await issueRecordService.receive({
        workspaceId: c.get("currentWorkspaceId"),
        environment: c.get("currentApiKeyEnvironment"),
        ...c.req.valid("json"),
      });

      return c.json(response satisfies IssueRecordAcceptedResponseDto, 202);
    },
  );

  return { create };
}
