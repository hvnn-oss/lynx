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
  /** Shared root-run state used to prevent duplicate automatic outcomes. */
  outcomeState?: {
    hasRecordedOutcome: boolean;
    lastStatus?: LynxSessionStatus;
    lastBusinessStatus?: LynxBusinessStatus;
  };
  /** Shared root-run state used to suppress duplicate issue candidates. */
  issueState?: {
    reportedErrorSignatures: string[];
    specificFailureReported: boolean;
    failedOutcomeReported: boolean;
  };
  /** Request-local counters used for repeated-call detection. */
  eventCounts?: Record<string, number>;
  /** Optional cancellation propagated to approval and guarded operations. */
  signal?: AbortSignal;
  /** Run-local counters used by stateful firewall policies. */
  firewallState?: {
    startedAt: number;
    totalCost: number;
    toolCallCounts: Record<string, number>;
  };
  /** Metadata merged into every subsequently captured event in this context. */
  attributes?: Record<string, any>;
  /** Prompt versions pinned for the lifetime of this run. */
  promptVersions?: Record<string, LynxPromptSnapshot>;
  /** Stable subject used to select prompt experiment variants within this run. */
  assignmentKey?: string;
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
  /** Cancels approval polling and other request-bound control operations. */
  signal?: AbortSignal;
  /**
   * Stable experiment subject such as a user or tenant identifier.
   *
   * When omitted, the session identifier is used so one session stays on the
   * same prompt variant.
   */
  assignmentKey?: string;
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
   * Centrally managed prompts and firewall policies.
   *
   * When enabled, the SDK loads the latest bundle before the first run and
   * refreshes it in the background. Explicit `initialize()` and `getPrompt()`
   * calls work even when automatic first-run loading is disabled.
   */
  runtimeConfig?: LynxRuntimeConfigOptions;

  /** Controls asynchronous reporting of SDK detections for server-side review. */
  issueReporting?: LynxIssueReportingOptions;

  /** Human approval flow used by `REQUIRE_APPROVAL` firewall decisions. */
  approval?: LynxApprovalOptions;

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

/** Controls server-backed human approval polling for protected tool calls. */
export interface LynxApprovalOptions {
  /** Enables approval requests. Disabled keeps REQUIRE_APPROVAL fail-closed. */
  enabled?: boolean;
  /** Maximum time a tool call waits for an operator decision. */
  timeoutMs?: number;
  /** Delay between approval status checks. */
  pollIntervalMs?: number;
  /** Deadline for each create or status HTTP request. */
  requestTimeoutMs?: number;
  /** Attempts for transient create or status request failures. */
  maxRequestAttempts?: number;
}

/** Controls the bounded background queue used to submit issue records. */
export interface LynxIssueReportingOptions {
  /** Enables automatic reporting of supported SDK detections. */
  enabled?: boolean;
  /** Reports an unhandled root-run exception or an explicit failed outcome. */
  reportRunFailures?: boolean;
  /** Reports errors raised by an instrumented LLM call. */
  reportLlmFailures?: boolean;
  /**
   * LLM latency threshold in milliseconds. Defaults to 10 seconds.
   *
   * Set this to `0` to disable slow-response issue candidates globally.
   */
  slowLlmThresholdMs?: number;
  /** Consecutive slow LLM calls required before reporting. Defaults to `2`. */
  slowLlmConsecutiveOccurrences?: number;
  /** Deadline in milliseconds for one issue-record request. */
  timeoutMs?: number;
  /** Maximum number of issue records retained in memory. */
  maxQueueSize?: number;
  /** Maximum delivery attempts before an issue record is discarded. */
  maxAttempts?: number;
  /** Consecutive healthy observations required before reporting recovery. */
  recoverySuccessThreshold?: number;
}

/** Local delivery health for automatic issue and recovery records. */
export interface LynxIssueReportingStatus {
  /** Whether issue reporting was explicitly enabled. */
  enabled: boolean;
  /** Whether the reporter has the API key required to deliver records. */
  configured: boolean;
  /** Records currently waiting for their first or a retry attempt. */
  queueSize: number;
  /** Records evicted because the bounded queue reached capacity. */
  droppedRecords: number;
  /** Records rejected locally or by a permanent HTTP response. */
  permanentlyRejectedRecords: number;
  /** Records currently being transmitted. */
  pendingTransmissions: number;
  /** ISO timestamp of the most recent accepted record. */
  lastDeliveryAt?: string;
  /** Sanitized reason for the latest delivery failure. */
  lastError?: string;
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
  /** Ed25519 public key used to verify server-signed runtime bundles. */
  signaturePublicKey?: string;
  /** Rejects unsigned bundles instead of accepting them for compatibility. */
  requireSignature?: boolean;
  /** Maximum age of a last-known-good bundle after refresh failures. */
  maxStaleAgeMs?: number;
  /** Rejects bundles resolved for a different environment or unknown Agent. */
  requireTargetMatch?: boolean;
  /** Optional persistent cache for the last validated runtime configuration. */
  cache?: LynxRuntimeConfigCacheOptions;
}

/** Portable byte storage used for persisted `.lynxconf` cache files. */
export interface LynxRuntimeConfigCacheStorage {
  /** Reads the previously stored cache, or `null` when it does not exist. */
  read(): Promise<Uint8Array | null>;
  /** Atomically replaces the stored cache with the supplied bytes. */
  write(data: Uint8Array): Promise<void>;
  /** Removes a corrupt or obsolete cache when supported by the environment. */
  remove?(): Promise<void>;
}

/** Controls whether and where managed prompts and policies are persisted. */
export interface LynxRuntimeConfigCacheOptions {
  /** Enables persistent caching. Defaults to `false`. */
  enabled?: boolean;
  /**
   * Exact `.lynxconf` file path used by the built-in Node.js storage.
   *
   * When omitted, the SDK uses the operating system's user cache directory.
   */
  path?: string;
  /** Replaces file storage for environments such as IndexedDB or mobile apps. */
  storage?: LynxRuntimeConfigCacheStorage;
}

/** Local persistence status for the last-known-good runtime configuration. */
export interface LynxRuntimeConfigCacheStatus {
  state: "DISABLED" | "EMPTY" | "READY" | "ERROR";
  /** Resolved path when the built-in Node.js file storage is used. */
  path?: string;
  /** Whether the current in-memory bundle was initially restored from cache. */
  loadedFromCache: boolean;
  /** ISO timestamp of the most recent successful cache write. */
  lastSavedAt?: string;
  /** Most recent non-fatal cache read or write error. */
  lastError?: string;
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
  /** A/B experiment assignment applied locally for the active run. */
  experiment?: LynxPromptExperimentAssignment;
}

/** Non-sensitive metadata describing one locally selected experiment variant. */
export interface LynxPromptExperimentAssignment {
  /** Stable server-side experiment identifier. */
  experimentId: string;
  /** Deterministic allocation bucket from 0 through 99. */
  bucket: number;
  /** Runtime configuration revision that contained the experiment. */
  runtimeConfigRevision: string;
}

/** Experiment exposure metadata attached to SDK events and stored per run. */
export interface LynxPromptExposure {
  experimentId: string;
  promptId: string;
  promptVersionId: string;
  bucket: number;
  runtimeConfigRevision: string;
}

/** One weighted immutable version in a prompt experiment. */
export interface LynxPromptExperimentVariant {
  /** Percentage bucket weight from 1 through 100. */
  weight: number;
  /** Exact immutable prompt version selected by this variant. */
  prompt: LynxPromptSnapshot;
}

/** Active prompt experiment evaluated locally for each run assignment key. */
export interface LynxPromptExperimentSnapshot {
  /** Stable server-side experiment identifier. */
  experimentId: string;
  /** Prompt whose deployed version is being compared. */
  promptId: string;
  /** Server-generated salt preventing assignment prediction across experiments. */
  assignmentSalt: string;
  /** Weighted prompt versions whose total weight must equal 100. */
  variants: LynxPromptExperimentVariant[];
}

/** Scope that the server used while constructing one runtime bundle. */
export interface LynxRuntimeConfigTarget {
  /** Environment embedded in the authenticated workspace API key. */
  environment: string;
  /** Agent identifier requested by the SDK, when supplied. */
  requestedAgentId?: string;
  /** Workspace Agent UUID resolved by the server, when found. */
  resolvedAgentId?: string;
}

/** Immutable description of one active remotely managed firewall policy. */
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
  /** Number of active prompt experiments available for local assignment. */
  experimentCount: number;
  /** Age of the last successfully validated bundle. */
  staleAgeMs?: number;
  /** Whether prompts and policies are still safe to execute locally. */
  isUsable: boolean;
  /** Server-resolved scope for the current bundle. */
  target?: LynxRuntimeConfigTarget;
  /** Indicates a configured environment or Agent scope mismatch. */
  targetMismatch?: boolean;
  /** Persistent cache health and location. */
  cache: LynxRuntimeConfigCacheStatus;
}

/**
 * Token usage returned by an LLM provider.
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** Describes whether an LLM call cost was reported or estimated. */
export type LynxCostSource =
  | "PROVIDER_REPORTED"
  | "CLIENT_REPORTED"
  | "CLIENT_ESTIMATED"
  | "SERVER_ESTIMATED"
  | "UNPRICED";

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
export type LynxFirewallFailureMode =
  | "FAIL_OPEN"
  | "FAIL_CLOSED"
  | "REQUIRE_APPROVAL";

/** @deprecated Use `LynxFirewallFailureMode`. */
export type LynxGuardFailureMode = LynxFirewallFailureMode;

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
  failureMode?: LynxFirewallFailureMode;
  /**
   * Maximum time to wait for an asynchronous tool result.
   *
   * A timeout rejects the wrapped call and reports a `TOOL_TIMEOUT` candidate,
   * but it cannot cancel underlying work unless the tool implements its own
   * cancellation.
   */
  timeoutMs?: number;
  /** Disable automatic `TOOL_ERROR` and `TOOL_TIMEOUT` issue candidates. */
  reportFailures?: boolean;
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

export interface LynxFirewallToolOptions<
  TArgs extends any[] = any[],
> extends LynxToolMetadata {
  beforeCall?: (context: {
    toolName: string;
    input: TArgs[0];
    args: TArgs;
    metadata?: LynxToolMetadata;
  }) => LynxPolicyDecision | Promise<LynxPolicyDecision>;
}

export interface LynxFirewallContentOptions {
  /** Event label used to identify the protected content boundary. */
  label?: string;
  /** Risk used to select the fallback behavior when local evaluation fails. */
  riskLevel?: LynxRiskLevel;
  /** Behavior used when managed policy evaluation is unavailable. */
  failureMode?: LynxFirewallFailureMode;
  /** Whether the evaluated content may be attached to policy events. */
  captureContent?: boolean;
}

/** Content selection and buffering options for guarded LLM calls. */
export interface LynxLlmFirewallBoundaryOptions extends LynxFirewallContentOptions {
  /** Selects the exact value evaluated from a provider request or response. */
  select?: (value: any) => unknown;
  /** Maximum trailing characters retained while inspecting a text stream. */
  maxStreamBufferChars?: number;
}

/** Options shared by telemetry-only and firewall-enabled LLM wrappers. */
export interface LynxLlmInstrumentationOptions {
  /** Event label used for the generated LLM Span. */
  modelLabel?: string;
  /** Provider-specific extraction and cost hooks. */
  customRule?: Partial<LlmInstrumentationRule>;
  /**
   * Optional local input and output policy boundaries.
   *
   * Omit this for telemetry-only instrumentation. `guardLLM()` enables both
   * boundaries by default.
   */
  firewall?: {
    input?: false | LynxLlmFirewallBoundaryOptions;
    output?: false | LynxLlmFirewallBoundaryOptions;
  };
  /** Disable automatic `LLM_ERROR` issue candidates for this wrapper. */
  reportFailures?: boolean;
  /** Disable slow-response issue candidates for this wrapper. */
  reportSlowResponses?: boolean;
  /** Override the global slow LLM threshold for this wrapper. */
  slowResponseThresholdMs?: number;
}

/** @deprecated Use `LynxFirewallToolOptions`. */
export type LynxGuardToolOptions<TArgs extends any[] = any[]> =
  LynxFirewallToolOptions<TArgs>;

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
  /** Health of the isolated issue and recovery reporting queue. */
  issueReporting: LynxIssueReportingStatus;
}

export * from "./openapi-contract.js";

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
  | "PROMPT_EXPOSURE"
  | "FIREWALL_ACTIVATED"
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
  costSource?: LynxCostSource;
  pricingVersion?: string;

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
  /** A/B variants selected in this run. Raw assignment keys are never included. */
  promptExposures?: LynxPromptExposure[];

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
