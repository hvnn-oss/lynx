import type {
  LynxConfig,
  LynxEventDto,
  LynxShutdownOptions,
  LynxStatus,
} from "../core/types.js";
import type { DeliveryBatchResult, LynxTransport } from "./delivery.types.js";

const DEFAULT_MAX_QUEUE_SIZE = 1000;
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60_000;

/** Owns telemetry queues and delivery lifecycle without affecting host requests. */
export class DeliveryManager {
  private readonly eventQueue: LynxEventDto[] = [];
  private readonly retryQueue: LynxEventDto[] = [];
  private readonly flushTimer: NodeJS.Timeout;
  private activeFlush?: Promise<void>;
  private shutdownWork?: Promise<void>;
  private isShuttingDown = false;
  private lastFailureTime = 0;
  private backoffDelayMs = DEFAULT_BACKOFF_MS;
  private consecutiveFailures = 0;
  private circuitOpenedAt = 0;
  private droppedEventCount = 0;
  private lastDeliveryAt?: string;
  private lastError?: string;

  constructor(
    private readonly config: LynxConfig,
    private readonly transport: LynxTransport,
  ) {
    const interval = config.delivery?.flushIntervalMs ?? 3000;
    this.flushTimer = setInterval(() => this.flushInBackground(), interval);
    this.flushTimer.unref?.();
  }

  /** Adds an event without waiting for network delivery. */
  enqueue(event: LynxEventDto): boolean {
    // shutdown() is a terminal lifecycle transition. Accepting more telemetry
    // after its timer has stopped would leave events stranded in memory.
    if (this.isShuttingDown) {
      this.droppedEventCount += 1;
      return false;
    }
    const queued = this.enqueueInto(this.eventQueue, event, false);
    if (
      queued &&
      this.getDeliveryMode() === "BLOCKING" &&
      this.eventQueue.length >= this.getBatchSize()
    ) {
      this.flushInBackground();
    }
    return queued;
  }

  /** Drains currently queued events in bounded batches. */
  async flush(): Promise<void> {
    await this.startFlush(true);
  }

  /** Starts one bounded flush attempt and returns immediately. */
  flushInBackground(): void {
    void this.startFlush(false);
  }

  /** Waits for a threshold-triggered blocking-mode transmission, if any. */
  async waitForIdle(): Promise<void> {
    if (this.activeFlush) await this.activeFlush;
  }

  /** Stops timers and drains queues within the optional caller deadline. */
  async shutdown(options: LynxShutdownOptions = {}): Promise<void> {
    if (!this.shutdownWork) {
      this.isShuttingDown = true;
      clearInterval(this.flushTimer);
      // All callers share one drain operation. A caller timing out must not
      // cancel delivery that another shutdown hook is still waiting for.
      this.shutdownWork = this.startFlush(true);
    }
    if (options.timeoutMs === undefined) {
      await this.shutdownWork;
      return;
    }
    await this.waitWithin(this.shutdownWork, options.timeoutMs);
  }

  getStatus(): Omit<LynxStatus, "runtimeConfig" | "issueReporting"> {
    return {
      queueSize: this.eventQueue.length + this.retryQueue.length,
      droppedEvents: this.droppedEventCount,
      circuitState: this.getCircuitState(),
      lastDeliveryAt: this.lastDeliveryAt,
      lastError: this.lastError,
      pendingTransmissions: this.activeFlush ? 1 : 0,
    };
  }

  private startFlush(drain: boolean): Promise<void> {
    // Every caller observes the same in-flight work. This makes await flush()
    // meaningful even when an interval started transmission first.
    if (this.activeFlush) {
      return drain
        ? this.activeFlush.then(() => this.startFlush(true))
        : this.activeFlush;
    }
    this.activeFlush = this.performFlush(drain).finally(() => {
      this.activeFlush = undefined;
    });
    return this.activeFlush;
  }

  private async waitWithin(
    work: Promise<void>,
    timeoutMs: number,
  ): Promise<void> {
    let timeout: NodeJS.Timeout | undefined;
    const deadline = new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, Math.max(0, timeoutMs));
      timeout.unref?.();
    });
    try {
      await Promise.race([work, deadline]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private async performFlush(drain: boolean): Promise<void> {
    do {
      if (!this.canAttemptDelivery()) return;
      const batch = this.takeBatch();
      if (batch.length === 0) return;

      const result = await this.transport.sendBatch(batch);
      this.handleResult(batch, result);
      if (
        result.status === "retryable-error" ||
        (result.status === "partial" && result.retryableEventIds.size > 0)
      ) {
        // Do not retry a partial batch in a tight drain loop. The server has
        // already classified those events for a later independent attempt.
        return;
      }
    } while (drain && this.hasQueuedEvents());
  }

  private takeBatch(): LynxEventDto[] {
    const batch: LynxEventDto[] = [];
    const batchSize = this.getBatchSize();
    while (batch.length < batchSize && this.retryQueue.length > 0) {
      batch.push(this.retryQueue.shift()!);
    }
    while (batch.length < batchSize && this.eventQueue.length > 0) {
      batch.push(this.eventQueue.shift()!);
    }
    return batch;
  }

  private handleResult(
    batch: LynxEventDto[],
    result: DeliveryBatchResult,
  ): void {
    if (result.status === "success") {
      this.recordSuccess();
      return;
    }
    if (result.status === "permanent-error") {
      this.droppedEventCount += batch.length;
      this.resetTransientFailureState();
      this.lastError = result.reason;
      return;
    }
    if (result.status === "partial") {
      for (const event of batch) {
        const eventId = event.eventId;
        if (eventId && result.retryableEventIds.has(eventId)) {
          this.enqueueInto(this.retryQueue, event, true);
        } else if (eventId && result.rejectedEventIds.has(eventId)) {
          this.droppedEventCount += 1;
        }
      }
      this.resetTransientFailureState();
      this.lastError = "batch_partial";
      return;
    }

    for (const event of batch) this.enqueueInto(this.retryQueue, event, true);
    this.recordRetryableFailure(result.reason, result.retryAfterMs);
  }

  private enqueueInto(
    queue: LynxEventDto[],
    event: LynxEventDto,
    isRetry: boolean,
  ): boolean {
    const maxQueueSize =
      this.config.delivery?.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE;
    if (maxQueueSize <= 0) {
      this.droppedEventCount += 1;
      return false;
    }
    if (this.eventQueue.length + this.retryQueue.length >= maxQueueSize) {
      this.droppedEventCount += 1;
      if (
        (this.config.delivery?.overflowStrategy ?? "DROP_OLDEST") ===
        "DROP_NEWEST"
      ) {
        return false;
      }
      // A retry predates newly captured telemetry. When preserving the oldest
      // event, sacrifice a new event first; normal enqueue uses chronological order.
      if (isRetry && this.eventQueue.length > 0) this.eventQueue.shift();
      else if (this.retryQueue.length > 0) this.retryQueue.shift();
      else this.eventQueue.shift();
    }
    queue.push(event);
    return true;
  }

  private canAttemptDelivery(): boolean {
    if (!this.hasQueuedEvents() || this.isCircuitOpen()) return false;
    return (
      this.lastFailureTime === 0 ||
      Date.now() - this.lastFailureTime >= this.backoffDelayMs
    );
  }

  private recordSuccess(): void {
    this.resetTransientFailureState();
    this.lastDeliveryAt = new Date().toISOString();
    this.lastError = undefined;
  }

  /** A reachable server closes transport backoff even when it rejects payloads. */
  private resetTransientFailureState(): void {
    this.lastFailureTime = 0;
    this.backoffDelayMs = DEFAULT_BACKOFF_MS;
    this.consecutiveFailures = 0;
    this.circuitOpenedAt = 0;
  }

  private recordRetryableFailure(reason: string, retryAfterMs?: number): void {
    this.lastFailureTime = Date.now();
    this.consecutiveFailures += 1;
    this.lastError = reason;
    if (
      (this.config.circuitBreaker?.enabled ?? true) &&
      this.consecutiveFailures >=
        (this.config.circuitBreaker?.failureThreshold ?? 3)
    ) {
      this.circuitOpenedAt = Date.now();
    }
    this.backoffDelayMs =
      retryAfterMs ?? Math.min(this.backoffDelayMs * 2, MAX_BACKOFF_MS);
  }

  private isCircuitOpen(): boolean {
    if (
      !(this.config.circuitBreaker?.enabled ?? true) ||
      this.circuitOpenedAt === 0
    ) {
      return false;
    }
    return (
      Date.now() - this.circuitOpenedAt <
      (this.config.circuitBreaker?.cooldownMs ?? 30_000)
    );
  }

  private getCircuitState(): LynxStatus["circuitState"] {
    if (!(this.config.circuitBreaker?.enabled ?? true)) return "DISABLED";
    if (this.circuitOpenedAt === 0) return "CLOSED";
    return this.isCircuitOpen() ? "OPEN" : "HALF_OPEN";
  }

  private getBatchSize(): number {
    return Math.max(1, this.config.delivery?.batchSize ?? DEFAULT_BATCH_SIZE);
  }

  private getDeliveryMode(): "BACKGROUND" | "BLOCKING" {
    return this.config.delivery?.mode ?? "BACKGROUND";
  }

  private hasQueuedEvents(): boolean {
    return this.eventQueue.length > 0 || this.retryQueue.length > 0;
  }
}
