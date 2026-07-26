import { firewallPolicyContract } from "@repo/contract";
import { Hono } from "hono";
import { requireAccessToken } from "../../common/middleware/access-token.middleware.js";
import type { AppEnv } from "../../common/types/app-env.js";
import { createFirewallPolicyHandlers } from "./firewall-policy.handler.js";

const handlers = createFirewallPolicyHandlers();

/** 워크스페이스 방화벽 정책 관리 API를 연결합니다. */
export const firewallPolicyRouter = new Hono<AppEnv>();

firewallPolicyRouter.use("*", requireAccessToken);
firewallPolicyRouter.on(
  firewallPolicyContract.list.method,
  firewallPolicyContract.list.path,
  ...handlers.list,
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
