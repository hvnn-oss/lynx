import { firewallApprovalContract } from "@repo/contract";
import { Hono } from "hono";
import { requireAccessToken } from "../../common/middleware/access-token.middleware.js";
import { requireProductAccess } from "../../common/middleware/product-access.middleware.js";
import type { AppEnv } from "../../common/types/app-env.js";
import { createFirewallApprovalHandlers } from "./firewall-approval.handler.js";

const handlers = createFirewallApprovalHandlers();

/** 로그인 운영자용 방화벽 승인 API를 연결합니다. */
export const firewallApprovalRouter = new Hono<AppEnv>();

firewallApprovalRouter.use("*", requireAccessToken);
firewallApprovalRouter.use("*", requireProductAccess);
firewallApprovalRouter.on(
  firewallApprovalContract.list.method,
  firewallApprovalContract.list.path,
  ...handlers.list,
);
firewallApprovalRouter.on(
  firewallApprovalContract.decide.method,
  firewallApprovalContract.decide.path,
  ...handlers.decide,
);
