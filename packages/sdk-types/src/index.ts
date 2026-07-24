/**
 * Execution context stored for the active Lynx trace.
 */
export interface LynxContext {
  /** Stable identifier shared by every event in one agent execution. */
  runId: string;
  /** Human-readable agent name used in operational views. */
  agentName: string;
  /** Current span; nested runs and instrumented calls create child spans. */
  spanId?: string;
  /** Span that caused the current span, used to rebuild the execution tree. */
  parentSpanId?: string;
  /** Sampling decision inherited by nested work in the same run. */
  sampled?: boolean;
  /** Optional tenant hint. The ingestion API must verify it against the API key. */
  workspaceId?: string;
  agentId?: string;
  sessionId?: string;
  /** Request-local counters used for repeated-call detection. */
  eventCounts?: Record<string, number>;
  /** Metadata merged into every subsequently captured event in this context. */
  attributes?: Record<string, any>;
  /** Prompt versions pinned for the lifetime of this run. */
  promptVersions?: Record<string, LynxPromptSnapshot>;
}

/**
 * Options used when starting an agent run.
 */
export interface LynxRunOptions {
  agentName: string;
  workspaceId?: string;
  agentId?: string;
  sessionId?: string;
  runId?: string;
}

/**
 * Configuration options for the Lynx SDK runtime.
 */
export interface LynxConfig {
  clientId: string;
  endpoint?: string;
  workspaceId?: string;
  agentId?: string;
  apiKey?: string;
  appVersion?: string;
  deploymentId?: string;
  environment?: string;
  policyVersion?: string;

  /**
   * Centrally managed prompts and guardrail policies.
   *
   * When enabled, the SDK loads the latest bundle before the first run and
   * refreshes it in the background. Explicit `initialize()` and `getPrompt()`
   * calls work even when automatic first-run loading is disabled.
   */
  runtimeConfig?: LynxRuntimeConfigOptions;

  /** Controls asynchronous reporting of SDK detections for server-side review. */
  issueReporting?: LynxIssueReportingOptions;

  /**
   * Telemetry sampling ratio between 0.0 and 1.0.
   *
   * For example, `0.1` captures roughly 10% of traces. When omitted, all traces
   * are captured unless a runtime context overrides sampling.
   */
  sampleRate?: number;

  /**
   * Whether request/input payloads should be captured.
   */
  captureInput?: boolean;

  /**
   * Whether response/output payloads should be captured.
   */
  captureOutput?: boolean;

  /**
   * Maximum serialized payload length for a single event.
   */
  maxPayloadLength?: number;

  /** Maximum UTF-8 JSON size retained for one processed event payload. */
  maxPayloadBytes?: number;

  /** Latency at which smart mode preserves detailed input/output. */
  smartDetailLatencyThresholdMs?: number;

  /**
   * Telemetry capture and retention mode.
   *
   * - `full`: Capture full input/output payloads.
   * - `metadata-only`: Capture structure, timing, usage, status, and error
   *   metadata without raw content.
   * - `smart`: Prefer metadata for normal events while preserving richer
   *   details for failures, policy violations, and abnormal latency.
   */
  captureMode?: "full" | "metadata-only" | "smart";

  /**
   * Structured telemetry delivery configuration.
   */
  delivery?: {
    /** BACKGROUND protects application latency; BLOCKING waits at flush points. */
    mode?: "BLOCKING" | "BACKGROUND";
    /** Per-request export deadline. Timed-out batches enter the retry queue. */
    timeoutMs?: number;
    /** Whether completion of run() should trigger an immediate flush attempt. */
    flushOnRunEnd?: boolean;
    /** Period between background flush attempts. */
    flushIntervalMs?: number;
    /** Number of queued events that triggers a non-background flush. */
    batchSize?: number;
    /** Combined upper bound for new and retry queues. */
    maxQueueSize?: number;
    /** Which event is sacrificed when the shared queue budget is exhausted. */
    overflowStrategy?: "DROP_OLDEST" | "DROP_NEWEST";
  };

  /**
   * Circuit breaker configuration for telemetry export only.
   */
  circuitBreaker?: {
    /** Disable only when the host application provides equivalent protection. */
    enabled?: boolean;
    /** Consecutive failed batches required to suspend exports. */
    failureThreshold?: number;
    /** Delay before one half-open delivery probe is allowed. */
    cooldownMs?: number;
  };
}

/** Controls the bounded background queue used to submit issue records. */
export interface LynxIssueReportingOptions {
  /** Enables automatic reporting of guardrail and loop detections. */
  enabled?: boolean;
  /** Deadline in milliseconds for one issue-record request. */
  timeoutMs?: number;
  /** Maximum number of issue records retained in memory. */
  maxQueueSize?: number;
  /** Maximum delivery attempts before an issue record is discarded. */
  maxAttempts?: number;
}

/** Controls how the SDK loads and refreshes managed prompts and policies. */
export interface LynxRuntimeConfigOptions {
  /**
   * Loads configuration automatically before the first run.
   *
   * Automatic loading fails open to protect host application availability.
   */
  enabled?: boolean;
  /** Interval in milliseconds between background refresh attempts. */
  refreshIntervalMs?: number;
  /** Deadline in milliseconds for one configuration request. */
  requestTimeoutMs?: number;
  /** Randomizes refresh timing from `0` to `1` to avoid synchronized requests. */
  refreshJitterRatio?: number;
}

/** Immutable description of one published prompt version used by the SDK. */
export interface LynxPromptSnapshot {
  /** Stable UUID of the managed prompt. */
  promptId: string;
  /** Human-readable stable name accepted by `getPrompt()`. */
  name: string;
  /** UUID of the exact prompt version represented by this snapshot. */
  versionId: string;
  /** Human-readable version label assigned by Lynx prompt versioning. */
  version: string;
  /** Prompt content supplied to the model or agent. */
  content: string;
  /** Lowercase SHA-256 digest used to verify prompt content integrity. */
  contentHash: string;
}

/** Immutable description of one active remotely managed guardrail policy. */
export interface LynxRuntimePolicySnapshot {
  /** Stable server-side policy identifier. */
  policyId: string;
  /** Human-readable policy name. */
  name: string;
  /** Optional explanation of the behavior controlled by this policy. */
  description: string | null;
  /** Version assigned by Lynx policy versioning. */
  version: string;
  /** Serialized condition consumed by the local policy evaluator. */
  condition: string;
  /** Severity reported when the policy matches. */
  severity: string;
  /** Action requested when the policy matches. */
  action: string;
}

/** Local health and freshness information for the runtime configuration cache. */
export interface LynxRuntimeConfigStatus {
  /** Current lifecycle state of the local runtime configuration cache. */
  state: "NOT_INITIALIZED" | "READY" | "REFRESHING" | "STALE" | "ERROR";
  /** Revision of the last valid bundle held in memory. */
  revision?: string;
  /** ISO timestamp of the latest successful fetch or revalidation. */
  lastUpdatedAt?: string;
  /** ISO timestamp at which the next background refresh is expected. */
  nextRefreshAt?: string;
  /** Most recent refresh error, retained for local diagnostics. */
  lastError?: string;
  /** Number of prompts in the current last-known-good bundle. */
  promptCount: number;
  /** Number of active policies in the current last-known-good bundle. */
  policyCount: number;
}

/**
 * Token usage returned by an LLM provider.
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type LynxSessionStatus = "COMPLETED" | "FAILED" | "CANCELLED";
export type LynxBusinessStatus = "SUCCEEDED" | "FAILED" | "PARTIAL" | "UNKNOWN";
export type LynxRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type LynxPolicyAction =
  | "ALLOW"
  | "BLOCK"
  | "WARN"
  | "REQUIRE_APPROVAL"
  | "REDACT"
  | "MODIFY";
export type LynxGuardFailureMode =
  | "FAIL_OPEN"
  | "FAIL_CLOSED"
  | "REQUIRE_APPROVAL";

export interface LynxOutcomeOptions {
  status: LynxSessionStatus;
  businessStatus?: LynxBusinessStatus;
  reason?: string;
  userImpact?: LynxRiskLevel;
  metadata?: Record<string, any>;
}

export interface LynxDecisionOptions {
  name: string;
  description?: string;
  selected?: string;
  alternatives?: string[];
  confidence?: number;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface LynxToolMetadata {
  toolVersion?: string;
  sideEffect?: boolean;
  riskLevel?: LynxRiskLevel;
  externalTarget?: string;
  idempotencyKey?: string;
  failureMode?: LynxGuardFailureMode;
  [key: string]: any;
}

export interface LynxPolicyDecision {
  allow?: boolean;
  action?: LynxPolicyAction;
  policyId?: string;
  policyVersion?: string;
  reason?: string;
  severity?: LynxRiskLevel;
  metadata?: Record<string, any>;
}

export interface LynxGuardToolOptions<
  TArgs extends any[] = any[],
> extends LynxToolMetadata {
  beforeCall?: (context: {
    toolName: string;
    input: TArgs[0];
    args: TArgs;
    metadata?: LynxToolMetadata;
  }) => LynxPolicyDecision | Promise<LynxPolicyDecision>;
}

export interface LynxShutdownOptions {
  timeoutMs?: number;
}

export interface LynxStatus {
  queueSize: number;
  droppedEvents: number;
  circuitState: "CLOSED" | "OPEN" | "HALF_OPEN" | "DISABLED";
  lastDeliveryAt?: string;
  lastError?: string;
  pendingTransmissions: number;
  /** Health and freshness of managed prompts and policies. */
  runtimeConfig: LynxRuntimeConfigStatus;
}

/**
 * Custom instrumentation rule for wrapping an LLM client method.
 */
export interface LlmInstrumentationRule {
  /**
   * Returns whether the current method path should be instrumented.
   */
  isTargetMethod: (path: string[]) => boolean;

  /**
   * Extracts prompt or input data from the intercepted method arguments.
   */
  extractInput?: (args: any[]) => any;

  /**
   * Extracts response content or structured output from the method result.
   */
  extractOutput?: (result: any) => any;

  /**
   * Extracts token usage from the method result.
   */
  extractUsage?: (result: any) => TokenUsage | undefined;

  /**
   * Estimates call cost from model and token usage.
   */
  estimateCost?: (
    model: string,
    promptTokens: number,
    completionTokens: number,
  ) => number;
}

/**
 * Event types captured by the Lynx SDK.
 */
export type LynxEventType =
  | "USER_INPUT"
  | "AGENT_DECISION"
  | "LLM_CALL"
  | "LLM_REASONING"
  | "TOOL_CALL"
  | "TOOL_RESULT"
  | "CALL_TOOLS"
  | "MEMORY_ACCESS"
  | "CONTEXT_RETRIEVAL"
  | "POLICY_EVALUATION"
  | "POLICY_VIOLATION"
  | "GUARDRAIL_ACTIVATED"
  | "SESSION_OUTCOME"
  | "LOOP_DETECTED"
  | "ERROR"
  | "CONTEXT_ALERT";

/**
 * Event payload schema used for trace, replay, and root-cause analysis.
 */
export interface LynxEventPayloadDto {
  input?: any;
  output?: any;
  error?: string;
  arguments?: any;

  // Span hierarchy
  spanId?: string;
  parentSpanId?: string;

  // Performance and cost analytics
  latency?: number;
  usage?: TokenUsage;
  cost?: number;

  // Runtime metadata for replay and root-cause analysis
  provider?: string;
  model?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  seed?: number | string;
  promptVersion?: string;
  systemPromptHash?: string;
  userPromptHash?: string;
  messageCount?: number;
  contextLength?: number;
  sdkVersion?: string;
  droppedEventCount?: number;
  appVersion?: string;
  deploymentId?: string;
  environment?: string;
  policyVersion?: string;

  // Tool execution metadata
  toolName?: string;
  toolVersion?: string;
  args?: any;
  argsHash?: string;
  result?: any;
  resultSummary?: string;
  sideEffect?: boolean;
  riskLevel?: LynxRiskLevel;
  externalTarget?: string;
  retryCount?: number;
  idempotencyKey?: string;

  // Loop runaway detection metadata
  loopDetected?: boolean;
  loopCount?: number;
  repeatedLabel?: string;

  // Prompt injection and context pollution metadata
  isPolluted?: boolean;
  pollutionReason?: string;

  [key: string]: any;
}

export interface LynxEventDto {
  /** Client-generated idempotency key; retries must reuse the same value. */
  eventId?: string;
  /** Identifies the service or SDK installation that emitted the event. */
  clientId: string;
  /** Groups all events belonging to one agent execution. */
  runId: string;
  agentName: string;
  eventType: LynxEventType;
  label: string;
  payload: LynxEventPayloadDto;
  /** Client wall-clock time in Unix milliseconds. */
  timestamp: number;
  /** Tenant hint validated by the server; it is never an authorization source. */
  workspaceId?: string;
  agentId?: string;
  sessionId?: string;
  /** Event contract version, independent of the installed SDK version. */
  schemaVersion?: string;
}
