import { env } from "../../common/config/config.js";
import type { FirewallWebhookEvent } from "../webhook/webhook.service.js";

interface SlackText {
  type: "plain_text" | "mrkdwn";
  text: string;
}

interface SlackBlock {
  type: "header" | "section" | "context" | "divider";
  text?: SlackText;
  fields?: SlackText[];
  elements?: SlackText[];
}

export interface SlackWebhookPayload {
  text: string;
  blocks: SlackBlock[];
}

/** Lynx 운영 이벤트를 Slack 알림용 Block Kit 메시지로 변환합니다. */
export class SlackMessageFormatter {
  format(event: FirewallWebhookEvent): SlackWebhookPayload {
    switch (event.type) {
      case "firewall.blocked":
        return this.firewallBlocked(event);
      case "approval.requested":
        return this.approvalRequested(event);
      case "approval.decided":
        return this.approvalDecided(event);
      case "slack.test":
        return this.testMessage(event);
      default:
        return this.testMessage(event);
    }
  }

  private firewallBlocked(event: FirewallWebhookEvent): SlackWebhookPayload {
    const toolName = this.read(event.data.toolName, "Unknown tool");
    const reason = this.read(event.data.reason, "A firewall policy matched.");
    const runId = this.read(event.data.runId, "");
    const text = `Lynx blocked ${toolName} because a firewall policy matched.`;
    return {
      text,
      blocks: [
        this.header("Firewall action blocked"),
        this.section(reason),
        this.fields([
          ["Tool", toolName],
          ["Agent", this.read(event.data.agentId, "Unknown")],
          ["Run", runId || "Unknown"],
          ["Workspace", event.workspaceId],
        ]),
        ...(runId
          ? [this.section(`<${this.runUrl(runId)}|Open run in Lynx>`, true)]
          : []),
        this.context(event),
      ],
    };
  }

  private approvalRequested(event: FirewallWebhookEvent): SlackWebhookPayload {
    const toolName = this.read(event.data.toolName, "Unknown tool");
    const approvalId = this.read(event.data.approvalId, "");
    const text = `Lynx approval is required before ${toolName} can continue.`;
    return {
      text,
      blocks: [
        this.header("Approval required"),
        this.section(
          `Lynx paused *${escapeSlack(toolName)}* until an operator reviews the request.`,
          true,
        ),
        this.fields([
          ["Agent", this.read(event.data.agentId, "Unknown")],
          ["Run", this.read(event.data.runId, "Unknown")],
          ["Expires", this.read(event.data.expiresAt, "Unknown")],
          ["Approval ID", approvalId || "Unknown"],
        ]),
        this.section(`<${this.approvalsUrl()}|Review approval in Lynx>`, true),
        this.context(event),
      ],
    };
  }

  private approvalDecided(event: FirewallWebhookEvent): SlackWebhookPayload {
    const status = this.read(event.data.status, "DECIDED");
    const toolName = this.read(event.data.toolName, "Unknown tool");
    const text = `Lynx approval for ${toolName} was ${status.toLowerCase()}.`;
    return {
      text,
      blocks: [
        this.header("Approval decision"),
        this.fields([
          ["Status", status],
          ["Tool", toolName],
          ["Run", this.read(event.data.runId, "Unknown")],
          [
            "Reason",
            this.read(event.data.decisionReason, "No reason provided"),
          ],
        ]),
        this.section(`<${this.approvalsUrl()}|Open approvals in Lynx>`, true),
        this.context(event),
      ],
    };
  }

  private testMessage(event: FirewallWebhookEvent): SlackWebhookPayload {
    return {
      text: "Lynx Slack integration test succeeded.",
      blocks: [
        this.header("Lynx is connected"),
        this.section(
          "This channel can now receive firewall and approval notifications from Lynx.",
        ),
        this.fields([
          ["Workspace", event.workspaceId],
          ["Connection", this.read(event.data.displayName, "Slack")],
        ]),
        this.context(event),
      ],
    };
  }

  private header(text: string): SlackBlock {
    return {
      type: "header",
      text: { type: "plain_text", text: text.slice(0, 150) },
    };
  }

  private section(text: string, isEscaped = false): SlackBlock {
    return {
      type: "section",
      text: {
        type: "mrkdwn",
        text: (isEscaped ? text : escapeSlack(text)).slice(0, 3_000),
      },
    };
  }

  private fields(entries: Array<[string, string]>): SlackBlock {
    return {
      type: "section",
      fields: entries.map(([label, value]) => ({
        type: "mrkdwn",
        text: `*${escapeSlack(label)}*\n${escapeSlack(value)}`.slice(0, 2_000),
      })),
    };
  }

  private context(event: FirewallWebhookEvent): SlackBlock {
    return {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Lynx · ${escapeSlack(event.type)} · ${escapeSlack(
            event.occurredAt,
          )}`,
        },
      ],
    };
  }

  private runUrl(runId: string): string {
    return new URL(
      `/dashboard/session/detail/${encodeURIComponent(runId)}`,
      env.FRONTEND_URL,
    ).toString();
  }

  private approvalsUrl(): string {
    return new URL("/firewall/approvals", env.FRONTEND_URL).toString();
  }

  private read(value: unknown, fallback: string): string {
    if (typeof value === "string" && value.trim()) {
      return value.trim().slice(0, 1_000);
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return fallback;
  }
}

function escapeSlack(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export const slackMessageFormatter = new SlackMessageFormatter();
