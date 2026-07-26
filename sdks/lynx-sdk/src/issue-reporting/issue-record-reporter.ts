import type { LynxIssueReportingOptions } from "../core/types.js";
import {
  SdkCreateIssueRecordSchema,
  SdkIssueRecordAcceptedResponseSchema,
} from "@repo/sdk-types";

/** Wire contract accepted by the Lynx issue-record ingestion endpoint. */
export interface SdkIssueRecord {
  sdkInstanceId: string;
  clientRecordId: string;
  recordKind: "DETECTION" | "RECOVERY";
  detectionType: string;
  runId?: string;
  sessionId?: string;
  eventId?: string;
  agentId: string;
  policyId?: string;
  promptVersionId?: string;
  detectedAt: number;
  payload: Record<string, unknown>;
  evidence?: Record<string, unknown>;
}

interface QueuedIssueRecord {
  record: SdkIssueRecord;
  attempts: number;
  availableAt: number;
}

interface IssueRecordReporterConnection {
  endpoint: string;
  apiKey?: string;
  clientId: string;
}

const DEFAULT_MAX_QUEUE_SIZE = 100;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_TIMEOUT_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;

/**
 * Sends SDK detections through an isolated, bounded background queue.
 *
 * Reporting failures never reject a customer tool call. Retryable records stay
 * in memory with exponential backoff and are discarded after a bounded number
 * of attempts or when queue capacity is exhausted.
 */
export class IssueRecordReporter {
  private readonly queue: QueuedIssueRecord[] = [];
  private activeDrain?: Promise<void>;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private isShuttingDown = false;

  constructor(
    private readonly connection: IssueRecordReporterConnection,
    private readonly options: LynxIssueReportingOptions = {},
  ) {}

  /** Enqueues one detection and starts delivery without waiting for network I/O. */
  report(record: SdkIssueRecord): void {
    if (!this.isEnabled() || this.isShuttingDown) return;
    const maxQueueSize =
      this.options.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE;
    if (maxQueueSize <= 0) return;
    if (this.queue.length >= maxQueueSize) this.queue.shift();
    this.queue.push({ record, attempts: 0, availableAt: Date.now() });
    this.drainInBackground();
  }

  /** Stops retry timers and makes a final bounded attempt for queued records. */
  async shutdown(timeoutMs?: number): Promise<void> {
    this.isShuttingDown = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    const work = this.startDrain(true);
    if (timeoutMs === undefined) {
      await work;
      return;
    }
    await Promise.race([
      work,
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, Math.max(0, timeoutMs));
        timer.unref?.();
      }),
    ]);
  }

  /** Returns whether automatic issue reporting has been explicitly enabled. */
  private isEnabled(): boolean {
    return this.options.enabled === true && Boolean(this.connection.apiKey);
  }

  /** Starts one drain operation while coalescing concurrent report calls. */
  private startDrain(force: boolean): Promise<void> {
    if (this.activeDrain) return this.activeDrain;
    this.activeDrain = this.performDrain(force).finally(() => {
      this.activeDrain = undefined;
    });
    return this.activeDrain;
  }

  /** Starts a drain without exposing its failure to customer code. */
  private drainInBackground(): void {
    void this.startDrain(false).catch(() => {
      // Individual failures are retained in the queue for a later retry.
    });
  }

  /** Delivers available records sequentially to keep background load bounded. */
  private async performDrain(force: boolean): Promise<void> {
    while (this.queue.length > 0) {
      const queued = this.queue[0]!;
      if (!force && queued.availableAt > Date.now()) {
        this.scheduleRetry(queued.availableAt - Date.now());
        return;
      }
      this.queue.shift();
      const delivered = await this.send(queued.record);
      if (delivered) continue;

      queued.attempts += 1;
      if (queued.attempts >= (this.options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)) {
        continue;
      }
      queued.availableAt =
        Date.now() +
        Math.min(MAX_RETRY_DELAY_MS, 1_000 * 2 ** (queued.attempts - 1));
      this.queue.push(queued);
      if (!force) {
        this.scheduleRetry(queued.availableAt - Date.now());
        return;
      }
    }
  }

  /** Sends one record and classifies every failure as isolated best-effort loss. */
  private async send(record: SdkIssueRecord): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    timeout.unref?.();
    try {
      const request = SdkCreateIssueRecordSchema.safeParse(record);
      if (!request.success) return false;
      const response = await fetch(
        `${this.connection.endpoint.replace(/\/$/, "")}/openapi/v1/issue-records`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": this.connection.apiKey!,
            "X-Lynx-Client-ID": this.connection.clientId,
          },
          body: JSON.stringify(request.data),
          signal: controller.signal,
        },
      );
      if (!response.ok) return false;
      return SdkIssueRecordAcceptedResponseSchema.safeParse(
        await response.json().catch(() => undefined),
      ).success;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Schedules exactly one retry timer for the oldest unavailable record. */
  private scheduleRetry(delayMs: number): void {
    if (this.retryTimer || this.isShuttingDown) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      this.drainInBackground();
    }, Math.max(0, delayMs));
    this.retryTimer.unref?.();
  }
}
