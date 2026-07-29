import { promptContract } from "@repo/contract";
import { Hono } from "hono";
import { requireAccessToken } from "../../common/middleware/access-token.middleware.js";
import { requireProductAccess } from "../../common/middleware/product-access.middleware.js";
import type { AppEnv } from "../../common/types/app-env.js";
import { createPromptHandlers } from "./prompt.handler.js";

const handlers = createPromptHandlers();

/** 워크스페이스 프롬프트 운영 API를 연결합니다. */
export const promptRouter = new Hono<AppEnv>();

promptRouter.use("*", requireAccessToken);
promptRouter.use("*", requireProductAccess);
promptRouter.on(
  promptContract.list.method,
  promptContract.list.path,
  ...handlers.list,
);
promptRouter.on(
  promptContract.getOperationsSummary.method,
  promptContract.getOperationsSummary.path,
  ...handlers.getOperationsSummary,
);
promptRouter.on(
  promptContract.listDeploymentOperations.method,
  promptContract.listDeploymentOperations.path,
  ...handlers.listDeploymentOperations,
);
promptRouter.on(
  promptContract.listExperimentOperations.method,
  promptContract.listExperimentOperations.path,
  ...handlers.listExperimentOperations,
);
promptRouter.on(
  promptContract.listTargetAgents.method,
  promptContract.listTargetAgents.path,
  ...handlers.listTargetAgents,
);
promptRouter.on(
  promptContract.get.method,
  promptContract.get.path,
  ...handlers.get,
);
promptRouter.on(
  promptContract.create.method,
  promptContract.create.path,
  ...handlers.create,
);
promptRouter.on(
  promptContract.update.method,
  promptContract.update.path,
  ...handlers.update,
);
promptRouter.on(
  promptContract.delete.method,
  promptContract.delete.path,
  ...handlers.deletePrompt,
);
promptRouter.on(
  promptContract.compareVersions.method,
  promptContract.compareVersions.path,
  ...handlers.compareVersions,
);
promptRouter.on(
  promptContract.createVersion.method,
  promptContract.createVersion.path,
  ...handlers.createVersion,
);
promptRouter.on(
  promptContract.listVersions.method,
  promptContract.listVersions.path,
  ...handlers.listVersions,
);
promptRouter.on(
  promptContract.getVersionMetrics.method,
  promptContract.getVersionMetrics.path,
  ...handlers.getVersionMetrics,
);
promptRouter.on(
  promptContract.getVersionPerformance.method,
  promptContract.getVersionPerformance.path,
  ...handlers.getVersionPerformance,
);
promptRouter.on(
  promptContract.deploy.method,
  promptContract.deploy.path,
  ...handlers.deploy,
);
promptRouter.on(
  promptContract.rollback.method,
  promptContract.rollback.path,
  ...handlers.rollback,
);
promptRouter.on(
  promptContract.listDeployments.method,
  promptContract.listDeployments.path,
  ...handlers.listDeployments,
);
promptRouter.on(
  promptContract.createExperiment.method,
  promptContract.createExperiment.path,
  ...handlers.createExperiment,
);
promptRouter.on(
  promptContract.listExperiments.method,
  promptContract.listExperiments.path,
  ...handlers.listExperiments,
);
promptRouter.on(
  promptContract.updateExperimentStatus.method,
  promptContract.updateExperimentStatus.path,
  ...handlers.updateExperimentStatus,
);
