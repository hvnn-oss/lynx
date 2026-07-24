import { zValidator } from "@hono/zod-validator";
import { workspaceContract } from "@repo/contract";
import { createFactory } from "hono/factory";
import { z } from "zod";
import type { AppEnv } from "../../common/types/app-env.js";
import { workspaceService } from "./workspace.service.js";

const factory = createFactory<AppEnv>();

/**
 * 워크스페이스 API의 입력 검증과 HTTP 응답 처리를 구성합니다.
 * @returns 라우터에 등록할 워크스페이스 생성 핸들러입니다.
 */
export function createWorkspaceHandlers() {
  /** 조직 권한과 요금제 한도를 확인해 새 워크스페이스를 생성합니다. */
  const create = factory.createHandlers(
    zValidator("json", workspaceContract.create.request),
    async (c) => {
      const workspace = await workspaceService.createWorkspace({
        userId: c.get("currentUserId"),
        ...c.req.valid("json"),
      });

      return c.json(
        workspace satisfies z.infer<
          typeof workspaceContract.create.response
        >,
        201,
      );
    },
  );

  /** 원문을 한 번만 반환하는 워크스페이스 API Key를 생성합니다. */
  const createApiKey = factory.createHandlers(
    zValidator("param", workspaceContract.createApiKey.params!),
    zValidator("json", workspaceContract.createApiKey.request),
    async (c) => {
      const created = await workspaceService.createApiKey({
        userId: c.get("currentUserId"),
        workspaceId: c.req.valid("param").workspaceId,
        ...c.req.valid("json"),
      });
      const response = {
        ...created,
        expiresAt: created.expiresAt?.toISOString() ?? null,
      } satisfies z.infer<typeof workspaceContract.createApiKey.response>;

      return c.json(response, 201);
    },
  );

  /** 로그인 사용자가 접근 가능한 워크스페이스의 Run 목록을 반환합니다. */
  const listRuns = factory.createHandlers(
    zValidator("param", workspaceContract.listRuns.params!),
    zValidator("query", workspaceContract.listRuns.request),
    async (c) => c.json(await workspaceService.listRuns({
      userId: c.get("currentUserId"),
      workspaceId: c.req.valid("param").workspaceId,
      ...c.req.valid("query"),
    })),
  );

  /** 로그인 사용자가 접근 가능한 Run의 Event 타임라인을 반환합니다. */
  const getRun = factory.createHandlers(
    zValidator("param", workspaceContract.getRun.params!),
    async (c) => {
      const params = c.req.valid("param");
      const run = await workspaceService.getRun({
        userId: c.get("currentUserId"),
        workspaceId: params.workspaceId,
        runId: params.runId,
      });
      return run
        ? c.json(run)
        : c.json({ code: "RUN_NOT_FOUND", message: "Run was not found." }, 404);
    },
  );

  return { create, createApiKey, listRuns, getRun };
}
