import { zValidator } from "@hono/zod-validator";
import { createFactory } from "hono/factory";
import type { AppEnv } from "../../common/types/app-env.js";
import { openAPIEventService } from "./event.service.js";
import {
  ingestBatchSchema,
  runListQuerySchema,
  runParamsSchema,
} from "./event.schema.js";

const factory = createFactory<AppEnv>();

/**
 * 이벤트 수집과 Run 조회를 담당하는 OpenAPI 핸들러를 생성합니다.
 *
 * 핸들러는 입력 검증과 HTTP 응답 변환만 담당하며, 워크스페이스 단위
 * 처리와 저장 로직은 서비스 계층에 위임합니다.
 */
export function createOpenAPIEventHandlers() {
  /** 검증된 SDK 이벤트 배치를 현재 API 키의 워크스페이스에 저장합니다. */
  const ingestBatch = factory.createHandlers(
    zValidator("json", ingestBatchSchema),
    async (c) =>
      c.json(
        await openAPIEventService.ingestBatch(
          c.get("currentWorkspaceId"),
          c.get("currentApiKeyEnvironment"),
          c.req.valid("json"),
        ),
        200,
      ),
  );

  /** 현재 워크스페이스의 최근 Run을 커서 기반으로 조회합니다. */
  const listRuns = factory.createHandlers(
    zValidator("query", runListQuerySchema),
    async (c) =>
      c.json(
        await openAPIEventService.listRuns(
          c.get("currentWorkspaceId"),
          c.req.valid("query"),
        ),
      ),
  );

  /** 하나의 Run과 시간순 이벤트 타임라인을 조회합니다. */
  const getRun = factory.createHandlers(
    zValidator("param", runParamsSchema),
    async (c) => {
      const run = await openAPIEventService.getRun(
        c.get("currentWorkspaceId"),
        c.req.valid("param").runId,
      );
      return run
        ? c.json(run)
        : c.json({ code: "RUN_NOT_FOUND", message: "Run was not found." }, 404);
    },
  );

  return { ingestBatch, listRuns, getRun };
}
