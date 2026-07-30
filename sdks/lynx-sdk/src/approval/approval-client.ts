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
const DEFAULT_MAX_REQUEST_ATTEMPTS = 3;

class PermanentApprovalRequestError extends Error {}

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
  async request(
    input: ApprovalRequestInput,
    signal?: AbortSignal,
  ): Promise<ApprovalStatus> {
    signal?.throwIfAborted();
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
        signal,
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
        signal,
      );
      current = SdkFirewallApprovalStatusResponseSchema.parse(
        await this.send(
          `/openapi/v1/firewall-approvals/${created.id}`,
          {
            method: "GET",
          },
          signal,
        ),
      );
    }
    return current.status === "PENDING"
      ? { ...current, status: "EXPIRED" }
      : current;
  }

  /** Executes one bounded authenticated approval API request. */
  private async send(
    path: string,
    init: RequestInit,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const maxAttempts = Math.max(
      1,
      this.options.maxRequestAttempts ?? DEFAULT_MAX_REQUEST_ATTEMPTS,
    );
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      signal?.throwIfAborted();
      const controller = new AbortController();
      const abortFromCaller = () => controller.abort(signal?.reason);
      signal?.addEventListener("abort", abortFromCaller, { once: true });
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
        if (response.ok) return response.json();
        const error = new Error(
          `Lynx approval request failed with status ${response.status}`,
        );
        if (!this.isRetryableStatus(response.status)) {
          throw new PermanentApprovalRequestError(error.message);
        }
        if (attempt === maxAttempts) {
          throw error;
        }
        lastError = error;
      } catch (error) {
        if (signal?.aborted) throw signal.reason ?? error;
        if (error instanceof PermanentApprovalRequestError) throw error;
        lastError = error;
        if (attempt === maxAttempts) throw error;
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abortFromCaller);
      }
      await this.delay(Math.min(1_000, 100 * 2 ** (attempt - 1)), signal);
    }
    throw lastError ?? new Error("Lynx approval request failed");
  }

  /** Waits for the next status poll while the protected tool call is pending. */
  private delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => {
          signal?.removeEventListener("abort", onAbort);
          resolve();
        },
        Math.max(0, milliseconds),
      );
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal?.reason ?? new Error("Lynx approval was aborted"));
      };
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  /** Returns whether one HTTP status may succeed when retried. */
  private isRetryableStatus(status: number): boolean {
    return status === 408 || status === 429 || status >= 500;
  }
}
