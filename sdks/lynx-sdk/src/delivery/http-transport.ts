import { SDK_VERSION } from "../version.js";
import {
  SdkIngestEventBatchResponseSchema,
  SdkIngestEventBatchSchema,
  type SdkIngestEventBatchResponse,
} from "@repo/sdk-types";
import type { LynxEventDto } from "../core/types.js";
import type {
  DeliveryBatchResult,
  LynxTransport,
} from "./delivery.types.js";

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export type HttpTransportOptions = {
  endpoint: string;
  apiKey?: string;
  clientId: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

/** Sends one bounded event batch and classifies failures for the delivery queue. */
export class HttpTransport implements LynxTransport {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HttpTransportOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async sendBatch(events: LynxEventDto[]): Promise<DeliveryBatchResult> {
    // The public ingestion API always requires a Workspace API key. Treat a
    // missing key as a local configuration error instead of generating noisy,
    // guaranteed-to-fail network requests.
    if (!this.options.apiKey) {
      return { status: "permanent-error", reason: "api_key_missing" };
    }
    const request = SdkIngestEventBatchSchema.safeParse(events);
    if (!request.success) {
      return {
        status: "permanent-error",
        reason: "request_contract_invalid",
      };
    }

    try {
      const response = await this.fetchImpl(
        `${this.options.endpoint}/openapi/v1/events/batch`,
        {
          method: "POST",
          headers: this.createHeaders(),
          body: JSON.stringify(request.data),
          signal: AbortSignal.timeout(this.options.timeoutMs),
        },
      );

      if (!response.ok) {
        return this.classifyHttpError(response);
      }

      const body = SdkIngestEventBatchResponseSchema.safeParse(
        await response.json().catch(() => undefined),
      );
      if (!body.success) {
        return {
          status: "retryable-error",
          reason: "response_contract_invalid",
        };
      }
      return this.parseSuccessResponse(body.data);
    } catch {
      // Network errors and timeouts are retryable. The SDK deliberately avoids
      // logging the raw error because runtimes may attach request credentials.
      return { status: "retryable-error", reason: "network_error" };
    }
  }

  private createHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Lynx-SDK-Version": SDK_VERSION,
      "X-Lynx-Client-ID": this.options.clientId,
    };
    // Workspace API keys use one dedicated header so they cannot be confused
    // with an end-user Bearer access token in proxies or application middleware.
    if (this.options.apiKey) headers["X-API-Key"] = this.options.apiKey;
    return headers;
  }

  private classifyHttpError(response: Response): DeliveryBatchResult {
    if (RETRYABLE_STATUS_CODES.has(response.status)) {
      const retryAfterMs = this.parseRetryAfter(response.headers.get("Retry-After"));
      return {
        status: "retryable-error",
        reason: `http_${response.status}`,
        retryAfterMs,
      };
    }
    return { status: "permanent-error", reason: `http_${response.status}` };
  }

  private parseSuccessResponse(
    result: SdkIngestEventBatchResponse,
  ): DeliveryBatchResult {
    if (result.success !== false) return { status: "success" };

    const retryableEventIds = this.readEventIds(result.retryableEventIds);
    const rejectedEventIds = this.readEventIds(result.rejectedEventIds);
    if (retryableEventIds.size > 0 || rejectedEventIds.size > 0) {
      return { status: "partial", retryableEventIds, rejectedEventIds };
    }
    return { status: "retryable-error", reason: "batch_failed" };
  }

  private readEventIds(value: unknown): Set<string> {
    if (!Array.isArray(value)) return new Set();
    return new Set(value.filter((item): item is string => typeof item === "string"));
  }

  private parseRetryAfter(value: string | null): number | undefined {
    if (!value) return undefined;
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const date = Date.parse(value);
    return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
  }
}
