import { firewallPolicyContract } from "@repo/contract";
import { Hono } from "hono";
import { requireAccessToken } from "../../common/middleware/access-token.middleware.js";
import { requireProductAccess } from "../../common/middleware/product-access.middleware.js";
import type { AppEnv } from "../../common/types/app-env.js";
import { createFirewallPolicyHandlers } from "./firewall-policy.handler.js";

const handlers = createFirewallPolicyHandlers();

/** 워크스페이스 방화벽 정책과 판단 기록 관리 API를 연결합니다. */
export const firewallPolicyRouter = new Hono<AppEnv>();

firewallPolicyRouter.use("*", requireAccessToken);
firewallPolicyRouter.use("*", requireProductAccess);
firewallPolicyRouter.on(
  firewallPolicyContract.list.method,
  firewallPolicyContract.list.path,
  ...handlers.list,
);
firewallPolicyRouter.on(
  firewallPolicyContract.detail.method,
  firewallPolicyContract.detail.path,
  ...handlers.detail,
);
firewallPolicyRouter.on(
  firewallPolicyContract.revisions.method,
  firewallPolicyContract.revisions.path,
  ...handlers.revisions,
);
firewallPolicyRouter.on(
  firewallPolicyContract.targetOptions.method,
  firewallPolicyContract.targetOptions.path,
  ...handlers.targetOptions,
);
firewallPolicyRouter.on(
  firewallPolicyContract.create.method,
  firewallPolicyContract.create.path,
  ...handlers.create,
);
firewallPolicyRouter.on(
  firewallPolicyContract.update.method,
  firewallPolicyContract.update.path,
  ...handlers.update,
);
firewallPolicyRouter.on(
  firewallPolicyContract.activate.method,
  firewallPolicyContract.activate.path,
  ...handlers.activate,
);
firewallPolicyRouter.on(
  firewallPolicyContract.deactivate.method,
  firewallPolicyContract.deactivate.path,
  ...handlers.deactivate,
);
firewallPolicyRouter.on(
  firewallPolicyContract.deploy.method,
  firewallPolicyContract.deploy.path,
  ...handlers.deploy,
);
firewallPolicyRouter.on(
  firewallPolicyContract.rollback.method,
  firewallPolicyContract.rollback.path,
  ...handlers.rollback,
);
firewallPolicyRouter.on(
  firewallPolicyContract.simulate.method,
  firewallPolicyContract.simulate.path,
  ...handlers.simulate,
);
firewallPolicyRouter.on(
  firewallPolicyContract.delete.method,
  firewallPolicyContract.delete.path,
  ...handlers.deletePolicy,
);
firewallPolicyRouter.on(
  firewallPolicyContract.records.method,
  firewallPolicyContract.records.path,
  ...handlers.records,
);
firewallPolicyRouter.on(
  firewallPolicyContract.webhookDeliveries.method,
  firewallPolicyContract.webhookDeliveries.path,
  ...handlers.webhookDeliveries,
);
firewallPolicyRouter.on(
  firewallPolicyContract.testWebhook.method,
  firewallPolicyContract.testWebhook.path,
  ...handlers.testWebhook,
);
firewallPolicyRouter.on(
  firewallPolicyContract.retryWebhookDelivery.method,
  firewallPolicyContract.retryWebhookDelivery.path,
  ...handlers.retryWebhookDelivery,
);
