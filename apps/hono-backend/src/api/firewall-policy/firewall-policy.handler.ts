import { zValidator } from "@hono/zod-validator";
import { firewallPolicyContract } from "@repo/contract";
import { createFactory } from "hono/factory";
import type { AppEnv } from "../../common/types/app-env.js";
import { firewallPolicyService } from "./firewall-policy.service.js";

const factory = createFactory<AppEnv>();

/** 로그인 사용자가 호출하는 방화벽 정책 HTTP 핸들러를 생성합니다. */
export function createFirewallPolicyHandlers() {
  const list = factory.createHandlers(
    zValidator("param", firewallPolicyContract.list.params!),
    async (c) => {
      const result = await firewallPolicyService.list(
        c.get("currentUserId"),
        c.req.valid("param").workspaceId,
      );
      return c.json(firewallPolicyContract.list.response.parse(result));
    },
  );

  const detail = factory.createHandlers(
    zValidator("param", firewallPolicyContract.detail.params!),
    async (c) => {
      const params = c.req.valid("param");
      const result = await firewallPolicyService.detail(
        c.get("currentUserId"),
        params.workspaceId,
        params.policyId,
      );
      return c.json(firewallPolicyContract.detail.response.parse(result));
    },
  );

  const revisions = factory.createHandlers(
    zValidator("param", firewallPolicyContract.revisions.params!),
    async (c) => {
      const params = c.req.valid("param");
      const result = await firewallPolicyService.revisions(
        c.get("currentUserId"),
        params.workspaceId,
        params.policyId,
      );
      return c.json(firewallPolicyContract.revisions.response.parse(result));
    },
  );

  const targetOptions = factory.createHandlers(
    zValidator("param", firewallPolicyContract.targetOptions.params!),
    async (c) => {
      const result = await firewallPolicyService.targetOptions(
        c.get("currentUserId"),
        c.req.valid("param").workspaceId,
      );
      return c.json(
        firewallPolicyContract.targetOptions.response.parse(result),
      );
    },
  );

  const create = factory.createHandlers(
    zValidator("param", firewallPolicyContract.create.params!),
    zValidator("json", firewallPolicyContract.create.request),
    async (c) => {
      const result = await firewallPolicyService.create(
        c.get("currentUserId"),
        c.req.valid("param").workspaceId,
        c.req.valid("json"),
      );
      return c.json(firewallPolicyContract.create.response.parse(result), 201);
    },
  );

  const update = factory.createHandlers(
    zValidator("param", firewallPolicyContract.update.params!),
    zValidator("json", firewallPolicyContract.update.request),
    async (c) => {
      const params = c.req.valid("param");
      const result = await firewallPolicyService.update(
        c.get("currentUserId"),
        params.workspaceId,
        params.policyId,
        c.req.valid("json"),
      );
      return c.json(firewallPolicyContract.update.response.parse(result));
    },
  );

  const activate = factory.createHandlers(
    zValidator("param", firewallPolicyContract.activate.params!),
    async (c) => {
      const params = c.req.valid("param");
      const result = await firewallPolicyService.activate(
        c.get("currentUserId"),
        params.workspaceId,
        params.policyId,
      );
      return c.json(firewallPolicyContract.activate.response.parse(result));
    },
  );

  const deactivate = factory.createHandlers(
    zValidator("param", firewallPolicyContract.deactivate.params!),
    async (c) => {
      const params = c.req.valid("param");
      const result = await firewallPolicyService.deactivate(
        c.get("currentUserId"),
        params.workspaceId,
        params.policyId,
      );
      return c.json(firewallPolicyContract.deactivate.response.parse(result));
    },
  );

  const deploy = factory.createHandlers(
    zValidator("param", firewallPolicyContract.deploy.params!),
    async (c) => {
      const params = c.req.valid("param");
      const result = await firewallPolicyService.deploy(
        c.get("currentUserId"),
        params.workspaceId,
        params.policyId,
      );
      return c.json(firewallPolicyContract.deploy.response.parse(result));
    },
  );

  const rollback = factory.createHandlers(
    zValidator("param", firewallPolicyContract.rollback.params!),
    async (c) => {
      const params = c.req.valid("param");
      const result = await firewallPolicyService.rollback(
        c.get("currentUserId"),
        params.workspaceId,
        params.policyId,
        params.revision,
      );
      return c.json(firewallPolicyContract.rollback.response.parse(result));
    },
  );

  const simulate = factory.createHandlers(
    zValidator("param", firewallPolicyContract.simulate.params!),
    zValidator("json", firewallPolicyContract.simulate.request),
    async (c) => {
      const params = c.req.valid("param");
      const result = await firewallPolicyService.simulate(
        c.get("currentUserId"),
        params.workspaceId,
        params.policyId,
        c.req.valid("json"),
      );
      return c.json(firewallPolicyContract.simulate.response.parse(result));
    },
  );

  const deletePolicy = factory.createHandlers(
    zValidator("param", firewallPolicyContract.delete.params!),
    async (c) => {
      const params = c.req.valid("param");
      const result = await firewallPolicyService.delete(
        c.get("currentUserId"),
        params.workspaceId,
        params.policyId,
      );
      return c.json(firewallPolicyContract.delete.response.parse(result));
    },
  );

  const records = factory.createHandlers(
    zValidator("param", firewallPolicyContract.records.params!),
    zValidator("query", firewallPolicyContract.records.request),
    async (c) => {
      const result = await firewallPolicyService.records(
        c.get("currentUserId"),
        c.req.valid("param").workspaceId,
        c.req.valid("query"),
      );
      return c.json(firewallPolicyContract.records.response.parse(result));
    },
  );

  const webhookDeliveries = factory.createHandlers(
    zValidator("param", firewallPolicyContract.webhookDeliveries.params!),
    zValidator("query", firewallPolicyContract.webhookDeliveries.request),
    async (c) => {
      const params = c.req.valid("param");
      const result = await firewallPolicyService.webhookDeliveries(
        c.get("currentUserId"),
        params.workspaceId,
        params.policyId,
        c.req.valid("query"),
      );
      return c.json(
        firewallPolicyContract.webhookDeliveries.response.parse(result),
      );
    },
  );

  const testWebhook = factory.createHandlers(
    zValidator("param", firewallPolicyContract.testWebhook.params!),
    async (c) => {
      const params = c.req.valid("param");
      const result = await firewallPolicyService.testWebhook(
        c.get("currentUserId"),
        params.workspaceId,
        params.policyId,
      );
      return c.json(firewallPolicyContract.testWebhook.response.parse(result));
    },
  );

  const retryWebhookDelivery = factory.createHandlers(
    zValidator("param", firewallPolicyContract.retryWebhookDelivery.params!),
    async (c) => {
      const params = c.req.valid("param");
      const result = await firewallPolicyService.retryWebhookDelivery(
        c.get("currentUserId"),
        params.workspaceId,
        params.policyId,
        params.deliveryId,
      );
      return c.json(
        firewallPolicyContract.retryWebhookDelivery.response.parse(result),
      );
    },
  );

  return {
    list,
    detail,
    revisions,
    targetOptions,
    create,
    update,
    activate,
    deactivate,
    deploy,
    rollback,
    simulate,
    deletePolicy,
    records,
    webhookDeliveries,
    testWebhook,
    retryWebhookDelivery,
  };
}
