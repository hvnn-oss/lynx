import { env } from "../../common/config/config.js";
import {
  WebhookRequestError,
  parseRetryAfter,
} from "../webhook/http-webhook.service.js";
import type { FirewallWebhookEvent } from "../webhook/webhook.service.js";
import {
  SlackMessageFormatter,
  slackMessageFormatter,
} from "./slack-message-formatter.js";

const SLACK_WEBHOOK_HOSTS = new Set(["hooks.slack.com", "hooks.slack-gov.com"]);
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429]);

/** Slack Incoming Webhook에 Block Kit 메시지를 안전하게 전송합니다. */
export class SlackWebhookService {
  constructor(
    private readonly formatter: SlackMessageFormatter = slackMessageFormatter,
  ) {}

  async send(
    value: string,
    event: FirewallWebhookEvent,
  ): Promise<{ statusCode: number }> {
    const destination = this.parseDestination(value);
    let response: Response;
    try {
      response = await fetch(destination, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "User-Agent": "Lynx-Slack-Webhook/1.0",
          "X-Lynx-Delivery": event.id,
        },
        body: JSON.stringify(this.formatter.format(event)),
        redirect: "manual",
        signal: AbortSignal.timeout(env.FIREWALL_WEBHOOK_TIMEOUT_MS),
      });
    } catch (error) {
      throw new WebhookRequestError(
        error instanceof Error
          ? `SLACK_WEBHOOK_NETWORK_ERROR:${error.message}`
          : "SLACK_WEBHOOK_NETWORK_ERROR",
        true,
      );
    }

    const responseBody = (await response.text()).trim();
    if (!response.ok) {
      const isRetryable =
        RETRYABLE_STATUS_CODES.has(response.status) || response.status >= 500;
      throw new WebhookRequestError(
        `SLACK_WEBHOOK_FAILED_${response.status}:${responseBody.slice(0, 200)}`,
        isRetryable,
        response.status,
        parseRetryAfter(response.headers.get("Retry-After")),
      );
    }
    if (responseBody !== "ok") {
      throw new WebhookRequestError(
        "SLACK_WEBHOOK_UNEXPECTED_RESPONSE",
        false,
        response.status,
      );
    }
    return { statusCode: response.status };
  }

  private parseDestination(value: string): URL {
    let destination: URL;
    try {
      destination = new URL(value);
    } catch {
      throw new WebhookRequestError("SLACK_WEBHOOK_URL_INVALID", false);
    }
    const pathSegments = destination.pathname.split("/").filter(Boolean);
    if (
      destination.protocol !== "https:" ||
      !SLACK_WEBHOOK_HOSTS.has(destination.hostname.toLowerCase()) ||
      destination.username ||
      destination.password ||
      destination.search ||
      destination.hash ||
      pathSegments[0] !== "services" ||
      pathSegments.length < 4
    ) {
      throw new WebhookRequestError("SLACK_WEBHOOK_URL_NOT_ALLOWED", false);
    }
    return destination;
  }
}

export const slackWebhookService = new SlackWebhookService();
