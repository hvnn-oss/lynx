import type { LynxEventDto } from "../core/types.js";

export type DeliveryBatchResult =
  | { status: "success" }
  | {
      status: "partial";
      retryableEventIds: ReadonlySet<string>;
      rejectedEventIds: ReadonlySet<string>;
    }
  | { status: "retryable-error"; reason: string; retryAfterMs?: number }
  | { status: "permanent-error"; reason: string };

export interface LynxTransport {
  sendBatch(events: LynxEventDto[]): Promise<DeliveryBatchResult>;
}
