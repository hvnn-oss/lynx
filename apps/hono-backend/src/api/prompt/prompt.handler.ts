import { zValidator } from "@hono/zod-validator";
import { promptContract } from "@repo/contract";
import { createFactory } from "hono/factory";
import type { AppEnv } from "../../common/types/app-env.js";
import { promptService } from "./prompt.service.js";

const factory = createFactory<AppEnv>();

/** 로그인 운영자가 사용하는 프롬프트 관리 HTTP 핸들러를 생성합니다. */
export function createPromptHandlers() {
  const list = factory.createHandlers(
    zValidator("param", promptContract.list.params!),
    async (c) =>
      c.json(
        promptContract.list.response.parse(
          await promptService.list(
            c.get("currentUserId"),
            c.req.valid("param").workspaceId,
          ),
        ),
      ),
  );
  const get = factory.createHandlers(
    zValidator("param", promptContract.get.params!),
    async (c) => {
      const params = c.req.valid("param");
      return c.json(
        promptContract.get.response.parse(
          await promptService.get(
            c.get("currentUserId"),
            params.workspaceId,
            params.promptId,
          ),
        ),
      );
    },
  );
  const create = factory.createHandlers(
    zValidator("param", promptContract.create.params!),
    zValidator("json", promptContract.create.request),
    async (c) =>
      c.json(
        promptContract.create.response.parse(
          await promptService.create(
            c.get("currentUserId"),
            c.req.valid("param").workspaceId,
            c.req.valid("json"),
          ),
        ),
        201,
      ),
  );
  const update = factory.createHandlers(
    zValidator("param", promptContract.update.params!),
    zValidator("json", promptContract.update.request),
    async (c) => {
      const params = c.req.valid("param");
      return c.json(
        promptContract.update.response.parse(
          await promptService.update(
            c.get("currentUserId"),
            params.workspaceId,
            params.promptId,
            c.req.valid("json"),
          ),
        ),
      );
    },
  );
  const deletePrompt = factory.createHandlers(
    zValidator("param", promptContract.delete.params!),
    async (c) => {
      const params = c.req.valid("param");
      return c.json(
        promptContract.delete.response.parse(
          await promptService.delete(
            c.get("currentUserId"),
            params.workspaceId,
            params.promptId,
          ),
        ),
      );
    },
  );
  const createVersion = factory.createHandlers(
    zValidator("param", promptContract.createVersion.params!),
    zValidator("json", promptContract.createVersion.request),
    async (c) => {
      const params = c.req.valid("param");
      return c.json(
        promptContract.createVersion.response.parse(
          await promptService.createVersion(
            c.get("currentUserId"),
            params.workspaceId,
            params.promptId,
            c.req.valid("json"),
          ),
        ),
        201,
      );
    },
  );
  const listVersions = factory.createHandlers(
    zValidator("param", promptContract.listVersions.params!),
    async (c) => {
      const params = c.req.valid("param");
      return c.json(
        promptContract.listVersions.response.parse(
          await promptService.listVersions(
            c.get("currentUserId"),
            params.workspaceId,
            params.promptId,
          ),
        ),
      );
    },
  );
  const compareVersions = factory.createHandlers(
    zValidator("param", promptContract.compareVersions.params!),
    zValidator("query", promptContract.compareVersions.request),
    async (c) => {
      const params = c.req.valid("param");
      const query = c.req.valid("query");
      return c.json(
        promptContract.compareVersions.response.parse(
          await promptService.compareVersions(
            c.get("currentUserId"),
            params.workspaceId,
            params.promptId,
            query.fromVersionId,
            query.toVersionId,
          ),
        ),
      );
    },
  );
  const deploy = factory.createHandlers(
    zValidator("param", promptContract.deploy.params!),
    zValidator("json", promptContract.deploy.request),
    async (c) => {
      const params = c.req.valid("param");
      return c.json(
        promptContract.deploy.response.parse(
          await promptService.deploy(
            c.get("currentUserId"),
            params.workspaceId,
            params.promptId,
            c.req.valid("json"),
          ),
        ),
        201,
      );
    },
  );
  const rollback = factory.createHandlers(
    zValidator("param", promptContract.rollback.params!),
    zValidator("json", promptContract.rollback.request),
    async (c) => {
      const params = c.req.valid("param");
      return c.json(
        promptContract.rollback.response.parse(
          await promptService.rollback(
            c.get("currentUserId"),
            params.workspaceId,
            params.promptId,
            c.req.valid("json"),
          ),
        ),
        201,
      );
    },
  );
  const listDeployments = factory.createHandlers(
    zValidator("param", promptContract.listDeployments.params!),
    async (c) => {
      const params = c.req.valid("param");
      return c.json(
        promptContract.listDeployments.response.parse(
          await promptService.listDeployments(
            c.get("currentUserId"),
            params.workspaceId,
            params.promptId,
          ),
        ),
      );
    },
  );
  const getVersionMetrics = factory.createHandlers(
    zValidator("param", promptContract.getVersionMetrics.params!),
    zValidator("query", promptContract.getVersionMetrics.request),
    async (c) => {
      const params = c.req.valid("param");
      return c.json(
        promptContract.getVersionMetrics.response.parse(
          await promptService.getVersionMetrics(
            c.get("currentUserId"),
            params.workspaceId,
            params.promptId,
            params.versionId,
            c.req.valid("query"),
          ),
        ),
      );
    },
  );
  const createExperiment = factory.createHandlers(
    zValidator("param", promptContract.createExperiment.params!),
    zValidator("json", promptContract.createExperiment.request),
    async (c) => {
      const params = c.req.valid("param");
      return c.json(
        promptContract.createExperiment.response.parse(
          await promptService.createExperiment(
            c.get("currentUserId"),
            params.workspaceId,
            params.promptId,
            c.req.valid("json"),
          ),
        ),
        201,
      );
    },
  );
  const listExperiments = factory.createHandlers(
    zValidator("param", promptContract.listExperiments.params!),
    async (c) => {
      const params = c.req.valid("param");
      return c.json(
        promptContract.listExperiments.response.parse(
          await promptService.listExperiments(
            c.get("currentUserId"),
            params.workspaceId,
            params.promptId,
          ),
        ),
      );
    },
  );
  const updateExperimentStatus = factory.createHandlers(
    zValidator("param", promptContract.updateExperimentStatus.params!),
    zValidator("json", promptContract.updateExperimentStatus.request),
    async (c) => {
      const params = c.req.valid("param");
      return c.json(
        promptContract.updateExperimentStatus.response.parse(
          await promptService.updateExperimentStatus(
            c.get("currentUserId"),
            params.workspaceId,
            params.promptId,
            params.experimentId,
            c.req.valid("json").status,
          ),
        ),
      );
    },
  );

  return {
    list,
    get,
    create,
    update,
    deletePrompt,
    createVersion,
    listVersions,
    compareVersions,
    deploy,
    rollback,
    listDeployments,
    getVersionMetrics,
    createExperiment,
    listExperiments,
    updateExperimentStatus,
  };
}
