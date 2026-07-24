import type {
  LynxPromptSnapshot,
  LynxRuntimePolicySnapshot,
} from "../core/types.js";

/** A complete, immutable-ready snapshot of remotely managed runtime settings. */
export interface RuntimeConfigBundle {
  /** Server-generated identifier that changes whenever bundle content changes. */
  revision: string;
  /** Current prompt versions available to this SDK workspace. */
  prompts: LynxPromptSnapshot[];
  /** Active guardrail policies available for local evaluation. */
  policies: LynxRuntimePolicySnapshot[];
}

/** Result of a conditional runtime configuration request. */
export type RuntimeConfigTransportResult =
  | { status: "NOT_MODIFIED"; etag?: string }
  | { status: "UPDATED"; etag?: string; bundle: RuntimeConfigBundle };

/** Fetches runtime configuration without coupling cache logic to HTTP. */
export interface RuntimeConfigTransport {
  /**
   * Fetches the current bundle, optionally using an ETag for revalidation.
   *
   * @param etag Previously observed HTTP entity tag.
   */
  fetch(etag?: string): Promise<RuntimeConfigTransportResult>;
}
