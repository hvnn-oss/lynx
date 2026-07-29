import { zValidator } from "@hono/zod-validator";
import { integrationContract } from "@repo/contract";
import { createFactory } from "hono/factory";
import type { AppEnv } from "../../common/types/app-env.js";
import { slackIntegrationService } from "./slack-integration.service.js";

const factory = createFactory<AppEnv>();

/** Slack Integration 계약에 맞는 HTTP handler를 생성합니다. */
export function createSlackIntegrationHandlers() {
  const get = factory.createHandlers(
    zValidator("param", integrationContract.getSlack.params!),
    async (c) =>
      c.json(
        integrationContract.getSlack.response.parse(
          await slackIntegrationService.get(
            c.get("currentUserId"),
            c.req.valid("param").workspaceId,
          ),
        ),
      ),
  );

  const update = factory.createHandlers(
    zValidator("param", integrationContract.updateSlack.params!),
    zValidator("json", integrationContract.updateSlack.request),
    async (c) =>
      c.json(
        integrationContract.updateSlack.response.parse(
          await slackIntegrationService.update(
            c.get("currentUserId"),
            c.req.valid("param").workspaceId,
            c.req.valid("json"),
          ),
        ),
      ),
  );

  const remove = factory.createHandlers(
    zValidator("param", integrationContract.deleteSlack.params!),
    async (c) =>
      c.json(
        integrationContract.deleteSlack.response.parse(
          await slackIntegrationService.delete(
            c.get("currentUserId"),
            c.req.valid("param").workspaceId,
          ),
        ),
      ),
  );

  const test = factory.createHandlers(
    zValidator("param", integrationContract.testSlack.params!),
    async (c) =>
      c.json(
        integrationContract.testSlack.response.parse(
          await slackIntegrationService.test(
            c.get("currentUserId"),
            c.req.valid("param").workspaceId,
          ),
        ),
      ),
  );

  const retry = factory.createHandlers(
    zValidator("param", integrationContract.retrySlackDelivery.params!),
    async (c) => {
      const params = c.req.valid("param");
      return c.json(
        integrationContract.retrySlackDelivery.response.parse(
          await slackIntegrationService.retry(
            c.get("currentUserId"),
            params.workspaceId,
            params.deliveryId,
          ),
        ),
      );
    },
  );

  return { get, update, remove, test, retry };
}
