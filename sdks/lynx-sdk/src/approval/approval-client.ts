import type { LynxApprovalOptions } from "../core/types.js";
import {
  SdkCreateFirewallApprovalSchema,
  SdkFirewallApprovalStatusResponseSchema,
} from "@repo/sdk-types";

interface ApprovalConnection {
  endpoint: string;
  apiKey?: string;
  clientId: string;
}

export interface ApprovalRequestInput {
  clientRequestId: string;
  runId: string;
  sessionId: string;
  agentId: string;
  policyId?: string;
  toolName: string;
  inputHash: string;
  reason?: string;
}

interface ApprovalStatus {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  expiresAt: string;
  decidedAt: string | null;
  decisionReason: string | null;
}

const DEFAULT_APPROVAL_TIMEOUT_MS = 5 * 60_000;
const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 2_000;

/**
 * Creates and polls server-backed approval requests for one protected tool call.
 *
 * Network failures and timeouts never allow the tool to run implicitly.
 */
export class ApprovalClient {
  constructor(
    private readonly connection: ApprovalConnection,
    private readonly options: LynxApprovalOptions = {},
  ) {}

  /** Waits until an operator approves, rejects, or the request expires. */
  async request(input: ApprovalRequestInput): Promise<ApprovalStatus> {
    if (!this.options.enabled) {
      throw new Error("Lynx approval flow is not enabled");
    }
    if (!this.connection.apiKey) {
      throw new Error("LYNX_API_KEY is required for approval requests");
    }
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_APPROVAL_TIMEOUT_MS;
    const request = SdkCreateFirewallApprovalSchema.parse({
      ...input,
      timeoutMs,
    });
    const created = SdkFirewallApprovalStatusResponseSchema.parse(
      await this.send(
        "/openapi/v1/firewall-approvals",
        {
          method: "POST",
          body: JSON.stringify(request),
        },
      ),
    );
    const deadline = Date.now() + timeoutMs;
    let current = created;
    while (current.status === "PENDING" && Date.now() < deadline) {
      await this.delay(
        Math.min(
          this.options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
          Math.max(0, deadline - Date.now()),
        ),
      );
      current = SdkFirewallApprovalStatusResponseSchema.parse(
        await this.send(`/openapi/v1/firewall-approvals/${created.id}`, {
          method: "GET",
        }),
      );
    }
    return current.status === "PENDING"
      ? { ...current, status: "EXPIRED" }
      : current;
  }

  /** Executes one bounded authenticated approval API request. */
  private async send(path: string, init: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
    );
    timeout.unref?.();
    try {
      const response = await fetch(
        `${this.connection.endpoint.replace(/\/$/, "")}${path}`,
        {
          ...init,
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": this.connection.apiKey!,
            "X-Lynx-Client-ID": this.connection.clientId,
          },
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new Error(
          `Lynx approval request failed with status ${response.status}`,
        );
      }
      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Waits for the next status poll while the protected tool call is pending. */
  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, Math.max(0, milliseconds));
    });
  }
}
