import { AsyncLocalStorage } from "async_hooks";
import {
  LynxConfig,
  LynxContext,
  LynxRunOptions,
  LynxEventDto,
  LynxFirewallContentOptions,
  LynxFirewallToolOptions,
  LynxOutcomeOptions,
  LynxPolicyDecision,
  LynxPolicyAction,
  LynxDecisionOptions,
  LynxToolMetadata,
  LynxShutdownOptions,
  LynxStatus,
  LynxPromptSnapshot,
  LynxPromptExposure,
  LynxLlmInstrumentationOptions,
} from "./types.js";
import { LYNX_EVENT_SCHEMA_VERSION } from "@repo/sdk-types";
import { processPayload } from "../utils/payload.js";
import {
  generateTraceId,
  generateSpanId,
  generateEventId,
} from "../utils/id.js";
import { instrumentLLM, instrumentTool } from "../instrumentation/index.js";
import { SDK_VERSION } from "../version.js";
import { DeliveryManager } from "../delivery/delivery-manager.js";
import { HttpTransport } from "../delivery/http-transport.js";
import { RuntimeConfigManager } from "../runtime-config/runtime-config-manager.js";
import { HttpRuntimeConfigTransport } from "../runtime-config/runtime-config-transport.js";
import { createRuntimeConfigCache } from "../runtime-config/runtime-config-cache.js";
import { LocalPolicyEvaluator } from "../firewall/local-policy-evaluator.js";
import { IssueRecordReporter } from "../issue-reporting/issue-record-reporter.js";
import { ApprovalClient } from "../approval/approval-client.js";
import { createStableHash } from "../utils/stable-hash.js";
import { assertValidAgentId } from "../utils/agent-id.js";
import {
  normalizeErrorCode,
  readErrorDetails,
} from "../utils/error-details.js";

export const DEFAULT_ENDPOINT = "https://api.lynxops.co";
const MAX_ACTIVE_DETECTIONS = 1_000;
const MAX_REPORTED_ERROR_SIGNATURES = 50;
const DEFAULT_SLOW_LLM_THRESHOLD_MS = 10_000;
const DEFAULT_SLOW_LLM_CONSECUTIVE_OCCURRENCES = 2;

interface ActiveDetection {
  detectionType: string;
  agentId: string;
  policyId?: string;
  promptVersionId?: string;
  payload: Record<string, unknown>;
  evidence?: Record<string, unknown>;
  healthyObservations: number;
}

export class LynxPolicyError extends Error {
  constructor(
    message: string,
    public readonly action: Extract<
      LynxPolicyAction,
      "BLOCK" | "REQUIRE_APPROVAL"
    >,
    public readonly policyId?: string,
    public readonly severity?: LynxToolMetadata["riskLevel"],
    public readonly reason?: string,
    public readonly metadata?: Record<string, any>,
  ) {
    super(message);
    this.name = "LynxPolicyError";
  }
}

/**
 * Main telemetry collector for Lynx-instrumented AI agent runtimes.
 *
 * `LynxTracer` owns the active async execution context, captures semantic
 * agent events, batches telemetry, retries failed deliveries, and provides
 * helpers for LLM/tool instrumentation. In most applications, use the shared
 * `lynx` instance exported from `@repo/sdk`; create a new instance only when
 * you need custom configuration per process or per test.
 *
 * @example
 * ```ts
 * const tracer = new LynxTracer({
 *   clientId: "support-service",
 *   apiKey: process.env.LYNX_API_KEY,
 * });
 *
 * await tracer.run("SupportAgent", async () => {
 *   tracer.userInput("refund my last order");
 *   tracer.decision("selected refund workflow");
 * });
 * ```
 */
export class LynxTracer {
  // AsyncLocalStorage keeps trace identifiers request-scoped even when many
  // agent runs execute concurrently in the same Node.js process.
  private static readonly storage = new AsyncLocalStorage<LynxContext>();
  // Instances are tracked only so the single process-level beforeExit hook can
  // give every tracer a chance to drain its in-memory queue.
  private static readonly instances = new Set<LynxTracer>();
  private static beforeExitHookRegistered = false;
  private readonly config: LynxConfig & { endpoint: string };
  private readonly delivery: DeliveryManager;
  private readonly runtimeConfig: RuntimeConfigManager;
  private readonly localPolicyEvaluator = new LocalPolicyEvaluator();
  private readonly issueReporter: IssueRecordReporter;
  private readonly approvalClient: ApprovalClient;
  private readonly activeDetections = new Map<string, ActiveDetection>();
  private readonly slowLlmObservations = new Map<string, number>();

  /**
   * Creates a tracer with the provided Lynx telemetry configuration.
   *
   * The constructor starts a background flush timer. The timer is unref'ed in
   * Node.js so it will not keep the process alive by itself. Call `shutdown()`
   * in tests, short-lived scripts, or server shutdown hooks to flush remaining
   * telemetry and clear the timer.
   *
   * @param config Runtime configuration for telemetry capture and delivery.
   */
  constructor(config: LynxConfig) {
    if (config.agentId !== undefined) {
      assertValidAgentId(config.agentId);
    }
    this.config = {
      ...config,
      endpoint: config.endpoint ?? DEFAULT_ENDPOINT,
    };
    this.delivery = new DeliveryManager(
      this.config,
      new HttpTransport({
        endpoint: this.config.endpoint,
        apiKey: this.config.apiKey,
        clientId: this.config.clientId,
        timeoutMs: this.config.delivery?.timeoutMs ?? 1000,
      }),
    );
    this.runtimeConfig = new RuntimeConfigManager(
      new HttpRuntimeConfigTransport({
        endpoint: this.config.endpoint,
        apiKey: this.config.apiKey,
        clientId: this.config.clientId,
        agentId: this.config.agentId,
        timeoutMs: this.config.runtimeConfig?.requestTimeoutMs ?? 1000,
      }),
      this.config.runtimeConfig,
      createRuntimeConfigCache({
        options: this.config.runtimeConfig?.cache,
        endpoint: this.config.endpoint,
        workspaceId: this.config.workspaceId,
        clientId: this.config.clientId,
        agentId: this.config.agentId,
        apiKey: this.config.apiKey,
      }),
      this.config.clientId,
      {
        environment: this.config.environment,
        agentId: this.config.agentId,
      },
    );
    this.issueReporter = new IssueRecordReporter(
      {
        endpoint: this.config.endpoint,
        apiKey: this.config.apiKey,
        clientId: this.config.clientId,
      },
      {
        ...this.config.issueReporting,
        enabled: this.config.issueReporting?.enabled === true,
      },
    );
    this.approvalClient = new ApprovalClient(
      {
        endpoint: this.config.endpoint,
        apiKey: this.config.apiKey,
        clientId: this.config.clientId,
      },
      this.config.approval,
    );

    LynxTracer.instances.add(this);

    // Flush remaining telemetry once when the process is about to exit.
    if (
      typeof process !== "undefined" &&
      !LynxTracer.beforeExitHookRegistered
    ) {
      LynxTracer.beforeExitHookRegistered = true;
      process.once("beforeExit", () => {
        void LynxTracer.shutdownAll();
      });
    }
  }

  private static async shutdownAll(): Promise<void> {
    await Promise.allSettled(
      Array.from(LynxTracer.instances).map((instance) => instance.shutdown()),
    );
  }

  /**
   * Returns the current Lynx async execution context, if one is active.
   *
   * This is mainly useful for advanced instrumentation helpers that need to
   * attach their own telemetry to the currently running `run()` context.
   *
   * @returns The current context, or `undefined` when called outside `run()`.
   */
  static getStore(): LynxContext | undefined {
    return LynxTracer.storage.getStore();
  }

  /**
   * Runs low-level instrumentation inside an explicit child Span context.
   *
   * The callback return value is intentionally generic rather than Promise-only
   * so wrapping a synchronous customer function does not change its runtime API.
   * Application code should normally use instrumentTool() or instrumentLLM().
   */
  static runWithContext<T>(context: LynxContext, callback: () => T): T {
    return LynxTracer.storage.run(context, callback);
  }

  private getFlushOnRunEnd(): boolean {
    return this.config.delivery?.flushOnRunEnd ?? false;
  }

  private isBackgroundOnly(): boolean {
    return (this.config.delivery?.mode ?? "BACKGROUND") === "BACKGROUND";
  }

  /**
   * Flushes queued telemetry events to the Lynx ingestion endpoint.
   *
   * Events are sent in a single batch request. If delivery fails, the batch is
   * moved into an in-memory retry queue and future flushes are delayed with
   * exponential backoff. Normal applications usually do not need to call this
   * manually because the tracer flushes on an interval.
   *
   * @returns A promise that resolves after the current flush attempt completes.
   */
  async flush(): Promise<void> {
    await Promise.all([this.delivery.flush(), this.issueReporter.flush()]);
  }

  /**
   * Loads the latest managed prompts and firewall policies.
   *
   * Concurrent calls share one request. Once a valid bundle has loaded, failed
   * refreshes keep serving that last-known-good snapshot.
   */
  async initialize(): Promise<void> {
    await this.runtimeConfig.initialize();
  }

  /**
   * Returns the active managed prompt by UUID or prompt name.
   *
   * A prompt first read inside `run()` is pinned to that run so a background
   * refresh cannot change its version halfway through an execution.
   */
  async getPrompt(id: string): Promise<LynxPromptSnapshot> {
    const context = LynxTracer.storage.getStore();
    const pinnedPrompt = context?.promptVersions?.[id];
    if (pinnedPrompt) return pinnedPrompt;

    const prompt = await this.runtimeConfig.getPrompt(
      id,
      context?.assignmentKey,
    );
    if (context) {
      context.promptVersions ??= {};
      context.promptVersions[id] = prompt;
      context.promptVersions[prompt.promptId] = prompt;
      context.promptVersions[prompt.name] = prompt;
      if (prompt.experiment) {
        this.captureInternal(
          "PROMPT_EXPOSURE",
          `prompt.exposure:${prompt.name}`,
          {
            promptId: prompt.promptId,
            promptVersionId: prompt.versionId,
            experimentId: prompt.experiment.experimentId,
            bucket: prompt.experiment.bucket,
            runtimeConfigRevision: prompt.experiment.runtimeConfigRevision,
          },
          context,
        );
      }
    }
    return prompt;
  }

  /**
   * Returns a lightweight snapshot of SDK delivery health.
   *
   * Use this for readiness diagnostics, operational dashboards, or tests. The
   * status reflects local SDK state only; it does not perform a network request.
   *
   * @returns Current queue, circuit breaker, and delivery state.
   */
  getStatus(): LynxStatus {
    return {
      ...this.delivery.getStatus(),
      runtimeConfig: this.runtimeConfig.getStatus(),
      issueReporting: this.issueReporter.getStatus(),
    };
  }

  /**
   * Flushes queued telemetry and releases SDK timers.
   *
   * Use this for graceful process shutdown, tests, CLI scripts, and serverless
   * handlers where the runtime may terminate before the background interval
   * fires. Calling `shutdown()` more than once is safe.
   *
   * @returns A promise that resolves after pending telemetry transmissions settle.
   */
  async shutdown(options: LynxShutdownOptions = {}): Promise<void> {
    await this.runtimeConfig.shutdown();
    await this.issueReporter.shutdown(options.timeoutMs);
    await this.delivery.shutdown(options);
    LynxTracer.instances.delete(this);
  }

  /**
   * Runs code inside a Lynx trace context.
   *
   * Every semantic event, instrumented LLM call, and instrumented tool call made
   * inside `executionBlock` will be associated with the same run/session. Nested
   * `run()` calls automatically inherit the parent run id and create a child
   * span relationship.
   *
   * @typeParam T The value returned by the wrapped execution block.
   * @param optionsOrAgentName Agent name or detailed run options.
   * @param executionBlock Function to execute while the Lynx context is active.
   * @returns The original return value of `executionBlock`.
   *
   * @example
   * ```ts
   * await lynx.run({ agentName: "SupportAgent", sessionId: "s-123" }, async () => {
   *   lynx.userInput("I need a refund");
   *   return await agent.handle();
   * });
   * ```
   */
  async run<T>(
    optionsOrAgentName: string | LynxRunOptions,
    executionBlock: () => Promise<T> | T,
  ): Promise<T> {
    const options =
      typeof optionsOrAgentName === "string"
        ? { agentName: optionsOrAgentName }
        : optionsOrAgentName;
    if (options.agentId !== undefined) {
      assertValidAgentId(options.agentId);
    }

    if (this.config.runtimeConfig?.enabled === true) {
      // Automatic control-plane loading is fail-open so a Lynx outage cannot
      // prevent the host application from serving a request. getPrompt()
      // remains explicit and will surface an error when no cached prompt exists.
      try {
        await this.initialize();
      } catch {
        // RuntimeConfigManager retains the diagnostic error in getStatus().
      }
    }

    const agentName = options.agentName;
    const parentContext = LynxTracer.storage.getStore();
    const runId =
      options.runId ??
      (parentContext ? parentContext.runId : generateTraceId());
    const parentSpanId = parentContext ? parentContext.spanId : undefined;
    const spanId = generateSpanId();

    const workspaceId =
      options.workspaceId ??
      parentContext?.workspaceId ??
      this.config.workspaceId ??
      process.env.LYNX_WORKSPACE_ID;
    const agentId =
      options.agentId ??
      parentContext?.agentId ??
      this.config.agentId ??
      process.env.LYNX_AGENT_ID ??
      agentName;
    const sessionId =
      options.sessionId ??
      parentContext?.sessionId ??
      process.env.LYNX_SESSION_ID ??
      `session_${runId}`;
    const assignmentKey =
      options.assignmentKey ??
      parentContext?.assignmentKey ??
      sessionId ??
      this.config.clientId;

    const sampled = parentContext
      ? (parentContext.sampled ?? true)
      : this.config.sampleRate !== undefined
        ? Math.random() < this.config.sampleRate
        : true;

    const currentContext: LynxContext = {
      runId,
      agentName,
      spanId,
      parentSpanId,
      sampled,
      workspaceId,
      agentId,
      sessionId,
      assignmentKey,
      signal: options.signal ?? parentContext?.signal,
      outcomeState: parentContext?.outcomeState ?? {
        hasRecordedOutcome: false,
      },
      issueState: parentContext?.issueState ?? {
        reportedErrorSignatures: [],
        specificFailureReported: false,
        failedOutcomeReported: false,
      },
      eventCounts: parentContext?.eventCounts ?? {},
      firewallState: parentContext?.firewallState ?? {
        startedAt: Date.now(),
        totalCost: 0,
        toolCallCounts: {},
      },
      attributes: { ...parentContext?.attributes },
      promptVersions: { ...parentContext?.promptVersions },
    };

    this.captureInternal(
      "CONTEXT_ALERT",
      `run.start:${agentName}`,
      {
        message: `Agent execution thread started`,
        phase: "start",
        spanId,
        parentSpanId,
      },
      currentContext,
    );

    const startTime = Date.now();

    return LynxTracer.storage.run(currentContext, async () => {
      try {
        const result = await executionBlock();
        const latency = Date.now() - startTime;

        this.captureInternal(
          "CONTEXT_ALERT",
          `run.end:${agentName}`,
          {
            message: `Agent execution thread succeeded`,
            phase: "end",
            spanId,
            parentSpanId,
            latency,
          },
          currentContext,
        );
        if (
          !parentContext &&
          !currentContext.outcomeState?.hasRecordedOutcome
        ) {
          if (currentContext.outcomeState) {
            currentContext.outcomeState.hasRecordedOutcome = true;
          }
          this.captureInternal(
            "SESSION_OUTCOME",
            "run.outcome:auto",
            {
              status: "COMPLETED",
              businessStatus: "UNKNOWN",
              reason: "The root run completed without an explicit outcome.",
              automatic: true,
              latency,
            },
            currentContext,
          );
        }
        if (!parentContext && !this.hasFailedOutcome(currentContext)) {
          this.reportRunRecovery(currentContext);
        }

        return result;
      } catch (err: any) {
        const latency = Date.now() - startTime;
        const error = readErrorDetails(err, "RUN_ERROR");
        this.captureInternal(
          "ERROR",
          `run.error:${agentName}`,
          {
            error: error.errorMessage,
            errorName: error.errorName,
            errorCode: error.errorCode,
            errorSignature: error.errorSignature,
            runFailure: !parentContext,
            suppressRunIssue: err instanceof LynxPolicyError,
            agentName,
            phase: "error",
            spanId,
            parentSpanId,
            latency,
          },
          currentContext,
        );
        if (
          !parentContext &&
          !currentContext.outcomeState?.hasRecordedOutcome
        ) {
          if (currentContext.outcomeState) {
            currentContext.outcomeState.hasRecordedOutcome = true;
          }
          this.captureInternal(
            "SESSION_OUTCOME",
            "run.outcome:auto",
            {
              status: "FAILED",
              businessStatus: "UNKNOWN",
              reason: error.errorMessage,
              error: error.errorMessage,
              automatic: true,
              latency,
            },
            currentContext,
          );
        }
        throw err;
      } finally {
        if (this.getFlushOnRunEnd()) {
          if (this.isBackgroundOnly()) {
            this.delivery.flushInBackground();
          } else {
            await Promise.all([
              this.delivery.flush(),
              this.issueReporter.flush(),
            ]);
          }
        }
        if (!this.isBackgroundOnly()) await this.delivery.waitForIdle();
      }
    });
  }

  /**
   * Captures a custom context event for the active run.
   *
   * Prefer semantic helpers such as `userInput()`, `decision()`, `context()`,
   * `memory()`, and `outcome()` when the event has a clear meaning. Use `log()`
   * for compatibility or for ad-hoc diagnostic payloads.
   *
   * @param label Human-readable event label.
   * @param payload JSON-serializable diagnostic payload.
   */
  log(label: string, payload: any): void {
    const context = LynxTracer.storage.getStore();
    if (context) {
      this.captureInternal("CONTEXT_ALERT", label, payload, context);
    } else {
      console.warn(
        "[LynxTracer] Log was called outside a running context. Event ignored.",
      );
    }
  }

  /**
   * Captures the user input that started or influenced the current agent run.
   *
   * This event gives root-cause analysis a clear starting point and separates
   * user intent from prompts, tool results, and internal agent state.
   *
   * @param input Raw or structured user input.
   * @param metadata Optional metadata such as `userId`, `channel`, or `locale`.
   */
  userInput(input: any, metadata: Record<string, any> = {}): void {
    this.capture("USER_INPUT", "user.input", { input, ...metadata });
  }

  /**
   * Captures an agent decision and the reason behind it.
   *
   * Use this when the agent chooses a workflow, tool, policy branch, or final
   * action. The `options` object can include candidates, confidence scores, or
   * any domain-specific reasoning metadata.
   *
   * @param reason Short explanation of the selected action.
   * @param options Optional structured metadata about the decision.
   */
  decision(
    reasonOrDecision: string | LynxDecisionOptions,
    options: Record<string, any> = {},
  ): void {
    if (typeof reasonOrDecision === "string") {
      this.capture("AGENT_DECISION", "agent.decision", {
        reason: reasonOrDecision,
        ...options,
      });
      return;
    }

    this.capture("AGENT_DECISION", `agent.decision:${reasonOrDecision.name}`, {
      ...reasonOrDecision,
      ...reasonOrDecision.metadata,
    });
  }

  /**
   * Captures retrieved or constructed context used by the agent.
   *
   * Use this for RAG results, conversation summaries, selected documents,
   * request-scoped state, or any context that may have influenced the next LLM
   * or tool call.
   *
   * @param data Context data or a summary of the context.
   * @param metadata Optional metadata such as source, query, score, or label.
   */
  context(
    labelOrData: string | any,
    dataOrMetadata: any = {},
    metadata: Record<string, any> = {},
  ): void {
    if (typeof labelOrData === "string") {
      this.capture("CONTEXT_RETRIEVAL", labelOrData, {
        data: dataOrMetadata,
        ...metadata,
      });
      return;
    }

    this.capture(
      "CONTEXT_RETRIEVAL",
      dataOrMetadata.label ?? "context.retrieval",
      {
        data: labelOrData,
        ...dataOrMetadata,
      },
    );
  }

  /**
   * Adds attributes to the current run context.
   *
   * Attributes are attached to subsequent events captured in the same async
   * context. Use this for stable request or business identifiers such as
   * `orderId`, `tenantId`, or `workflowId`.
   *
   * @param attributes Key-value attributes to merge into the active context.
   */
  setAttributes(attributes: Record<string, any>): void {
    const context = LynxTracer.storage.getStore();
    if (!context) {
      console.warn("[LynxTracer] setAttributes called outside a run context.");
      return;
    }

    context.attributes = {
      ...context.attributes,
      ...attributes,
    };
  }

  /**
   * Captures access to short-term or long-term agent memory.
   *
   * This helps identify stale memory, missing memory, or memory values that
   * influenced an incorrect action.
   *
   * @param operation Memory operation name, such as `read`, `write`, or `search`.
   * @param data Memory key/value, query result, or a safe summary.
   * @param metadata Optional metadata such as hit/miss, store name, or freshness.
   */
  memory(
    operation: string,
    data: any,
    metadata: Record<string, any> = {},
  ): void {
    this.capture("MEMORY_ACCESS", `memory.${operation}`, {
      operation,
      data,
      ...metadata,
    });
  }

  /**
   * Captures the final technical and business outcome of the current session.
   *
   * Use this to distinguish "the code ran successfully" from "the business task
   * succeeded." That distinction is central for detecting AI failures that do
   * not throw runtime exceptions.
   *
   * @param options Outcome status, business status, reason, impact, and metadata.
   */
  outcome(options: LynxOutcomeOptions): void {
    const context = LynxTracer.storage.getStore();
    if (!context) {
      console.warn(
        "[LynxTracer] Warning: outcome was captured outside a LynxTracer context!",
      );
      return;
    }

    if (context.outcomeState) {
      context.outcomeState.hasRecordedOutcome = true;
      context.outcomeState.lastStatus = options.status;
      context.outcomeState.lastBusinessStatus = options.businessStatus;
    }
    const eventId = this.captureInternal(
      "SESSION_OUTCOME",
      "session.outcome",
      options,
      context,
    );
    if (
      options.status === "FAILED" ||
      options.businessStatus === "FAILED"
    ) {
      this.reportFailedOutcome(eventId, options, context);
    }
  }

  /**
   * Captures a human-readable annotation for the active run.
   *
   * `annotate()` is intended for breadcrumbs that help operators understand the
   * trace but do not fit one of the stricter semantic event helpers.
   *
   * @param label Annotation label.
   * @param payload JSON-serializable annotation payload.
   */
  annotate(label: string, payload: any): void {
    this.capture("CONTEXT_ALERT", label, { annotation: true, ...payload });
  }

  /**
   * Captures a semantic event for the active Lynx run context.
   */
  private capture(
    eventType: LynxEventDto["eventType"],
    label: string,
    payload: any,
  ): void {
    const context = LynxTracer.storage.getStore();
    if (!context) {
      console.warn(
        `[LynxTracer] Warning: event ${eventType} was captured outside a LynxTracer context!`,
      );
      return;
    }
    this.captureInternal(eventType, label, payload, context);
  }

  /**
   * Captures an event using an explicit Lynx context.
   *
   * This method is public for low-level instrumentation modules, but application
   * code should usually call the semantic helpers or `instrumentLLM()` /
   * `instrumentTool()` instead. Payloads are processed for PII masking,
   * capture-mode filtering, runtime metadata, and loop detection before they are
   * queued for delivery.
   *
   * @param eventType Lynx event type to record.
   * @param label Human-readable event label.
   * @param payload JSON-serializable event payload.
   * @param context Explicit Lynx trace context.
   */
  captureInternal(
    eventType: LynxEventDto["eventType"],
    label: string,
    payload: any,
    context: LynxContext,
  ): string | undefined {
    const capturedCost = Number(payload?.cost);
    if (
      context.firewallState &&
      Number.isFinite(capturedCost) &&
      capturedCost > 0 &&
      payload?.phase !== "start"
    ) {
      context.firewallState.totalCost += capturedCost;
    }
    // Safety detection must run before telemetry sampling. Sampling controls
    // storage volume, while loop and policy signals remain operational.
    const loopPayload = this.detectLoop(eventType, label, payload, context);
    const eventId = generateEventId();
    if (eventType === "TOOL_RESULT" && payload?.toolFailureRecovery === true) {
      this.reportToolRecovery(payload, context);
    }
    if (eventType === "LLM_CALL" && payload?.llmIssueObservation === true) {
      this.reportLlmObservation(eventId, payload, context);
    }

    // Tail-based/adaptive sampling fallback keeps error-related events even
    // when the current context is sampled out, so failures remain debuggable.
    const isError =
      eventType === "ERROR" ||
      (eventType === "SESSION_OUTCOME" && payload?.status === "FAILED") ||
      (payload && (payload.error || "error" in payload));
    const isOperationalMetadata =
      eventType === "PROMPT_EXPOSURE" || eventType === "SESSION_OUTCOME";
    if (context.sampled === false && !isError && !isOperationalMetadata) {
      return eventId;
    }

    const promptExposures = this.getPromptExposures(context);
    const processedPayload = processPayload(
      {
        ...context.attributes,
        ...payload,
        ...loopPayload,
        sdkVersion: SDK_VERSION,
        droppedEventCount: this.delivery.getStatus().droppedEvents || undefined,
        appVersion: payload?.appVersion ?? this.config.appVersion,
        deploymentId: payload?.deploymentId ?? this.config.deploymentId,
        environment: payload?.environment ?? this.config.environment,
        policyVersion: payload?.policyVersion ?? this.config.policyVersion,
        promptVersionIds: Object.values(context.promptVersions ?? {}).length
          ? [
              ...new Set(
                Object.values(context.promptVersions ?? {}).map(
                  (prompt) => prompt.versionId,
                ),
              ),
            ]
          : undefined,
        promptExposures:
          promptExposures.length > 0 ? promptExposures : undefined,
      },
      this.config,
      { eventType },
    );

    // Instrumentation may create a child span explicitly. Fall back to the
    // active run span only when the processed payload did not provide one.
    const eventPayload = {
      ...processedPayload,
      spanId: processedPayload.spanId || context.spanId,
      parentSpanId: processedPayload.parentSpanId || context.parentSpanId,
    };
    if (eventType === "ERROR" && eventPayload.toolFailure === true) {
      this.reportToolFailure(eventId, eventPayload, context);
    }
    if (eventType === "ERROR" && eventPayload.llmFailure === true) {
      this.reportLlmFailure(eventId, eventPayload, context);
    }
    if (eventType === "ERROR" && eventPayload.runFailure === true) {
      this.reportRunFailure(eventId, eventPayload, context);
    }

    const eventDto: LynxEventDto = {
      eventId,
      clientId: this.config.clientId,
      runId: context.runId,
      agentName: context.agentName,
      eventType,
      label,
      payload: eventPayload,
      timestamp: Date.now(),
      workspaceId: context.workspaceId,
      agentId: context.agentId,
      sessionId: context.sessionId,
      schemaVersion: LYNX_EVENT_SCHEMA_VERSION,
    };

    const queued = this.delivery.enqueue(eventDto);
    if (!queued) {
      return eventId;
    }

    // Emit a separate semantic event for dashboards and policies. The guard
    // prevents the synthetic event from recursively generating itself.
    if (loopPayload.loopDetected && eventType !== "LOOP_DETECTED") {
      this.captureInternal(
        "LOOP_DETECTED",
        `loop:${label}`,
        {
          repeatedLabel: label,
          loopCount: loopPayload.loopCount,
          argsHash: loopPayload.argsHash,
        },
        context,
      );
    }
    return eventId;
  }

  /**
   * Wraps an LLM client with automatic Lynx telemetry.
   *
   * The returned proxy preserves the original client shape while intercepting
   * supported generation methods such as OpenAI `chat.completions.create`,
   * Anthropic `messages.create`, Google `generateContent`, Vercel AI SDK
   * `generateText`, LangChain `invoke`, and similar methods. Captured telemetry
   * includes input/output, provider, model, generation config, latency, token
   * usage, span ids, and errors.
   *
   * @typeParam T LLM client object type.
   * @param instance LLM client instance to wrap.
   * @param optionsOrLabel Event label or custom extraction/interception rules.
   * @returns A proxy with the same public interface as `instance`.
   */
  instrumentLLM<T extends object>(
    instance: T,
    optionsOrLabel: string | LynxLlmInstrumentationOptions = "llm.inference",
  ): T {
    return instrumentLLM(this, instance, optionsOrLabel);
  }

  /**
   * Wraps an LLM client with telemetry and local input/output policy checks.
   *
   * Non-streaming output is checked before it is returned. Async iterable
   * output is checked before each chunk is yielded, using a bounded trailing
   * text buffer so matches split across chunks are still detected.
   *
   * @typeParam T LLM client object type.
   * @param instance LLM client instance to protect.
   * @param options Provider extraction and firewall boundary options.
   * @returns A proxy with the same public interface as `instance`.
   */
  guardLLM<T extends object>(
    instance: T,
    options: LynxLlmInstrumentationOptions = {},
  ): T {
    return instrumentLLM(this, instance, {
      ...options,
      firewall: {
        input: options.firewall?.input ?? {},
        output: options.firewall?.output ?? {},
      },
    });
  }

  /**
   * Wraps a tool function with automatic Lynx telemetry.
   *
   * The wrapped function emits `TOOL_CALL` before execution and `TOOL_RESULT`
   * after success. Errors are captured as `ERROR` and then rethrown. Use
   * `metadata` to describe side effects, risk level, external targets, or tool
   * version so debugging and governance views can reason about the call.
   *
   * @typeParam T Tool function type.
   * @param toolName Stable tool name shown in traces and analytics.
   * @param fn Tool function to execute.
   * @param metadata Optional tool metadata for governance and RCA.
   * @returns A wrapped function with the same call signature as `fn`.
   */
  instrumentTool<T extends (...args: any[]) => any>(
    toolName: string,
    fn: T,
    metadata: LynxToolMetadata = {},
  ): T {
    return instrumentTool(this, toolName, fn, metadata);
  }

  private getDefaultFailureMode(
    riskLevel: LynxToolMetadata["riskLevel"],
  ): NonNullable<LynxToolMetadata["failureMode"]> {
    // Policy infrastructure failure must not silently permit destructive tools.
    // Lower-risk observability remains fail-open to protect customer uptime.
    if (riskLevel === "HIGH" || riskLevel === "CRITICAL") {
      return "FAIL_CLOSED";
    }
    if (riskLevel === "MEDIUM") {
      return "REQUIRE_APPROVAL";
    }
    return "FAIL_OPEN";
  }

  private normalizePolicyDecision(
    decision: LynxPolicyDecision,
  ): LynxPolicyDecision & { action: LynxPolicyAction; allow: boolean } {
    const action =
      decision.action ?? (decision.allow === false ? "BLOCK" : "ALLOW");
    const allow = action === "ALLOW" || action === "WARN";

    return {
      ...decision,
      action,
      allow,
    };
  }

  private decisionFromPolicyError(
    err: unknown,
    options: LynxToolMetadata,
  ): LynxPolicyDecision & { action: LynxPolicyAction; allow: boolean } {
    const failureMode =
      options.failureMode ?? this.getDefaultFailureMode(options.riskLevel);
    const reason =
      err instanceof Error ? err.message : "Policy evaluation failed";
    const action: LynxPolicyAction =
      failureMode === "FAIL_OPEN"
        ? "ALLOW"
        : failureMode === "REQUIRE_APPROVAL"
          ? "REQUIRE_APPROVAL"
          : "BLOCK";

    return {
      action,
      allow: action === "ALLOW",
      reason,
      severity: options.riskLevel,
      metadata: {
        policyError: true,
        failureMode,
      },
    };
  }

  /** Returns the stronger of managed and application-provided policy decisions. */
  private selectPolicyDecision(
    decisions: LynxPolicyDecision[],
  ): LynxPolicyDecision & { action: LynxPolicyAction; allow: boolean } {
    const rank: Record<LynxPolicyAction, number> = {
      ALLOW: 1,
      WARN: 2,
      MODIFY: 3,
      REDACT: 3,
      REQUIRE_APPROVAL: 4,
      BLOCK: 5,
    };
    return decisions
      .map((decision) => this.normalizePolicyDecision(decision))
      .sort((left, right) => rank[right.action] - rank[left.action])[0]!;
  }

  /** Evaluates the cached managed policies without making a network request. */
  private evaluateManagedPolicies(
    toolName: string,
    input: unknown,
    options: LynxToolMetadata,
    output?: unknown,
  ): LynxPolicyDecision {
    const status = this.runtimeConfig.getStatus();
    if (
      this.config.runtimeConfig?.enabled === true &&
      (status.state === "ERROR" || status.state === "NOT_INITIALIZED")
    ) {
      throw new Error(
        status.lastError ?? "Managed Lynx policies are not available",
      );
    }
    const context = LynxTracer.storage.getStore();
    const firewallState = context?.firewallState;
    const callCount = (firewallState?.toolCallCounts[toolName] ?? 0) + 1;
    if (firewallState) firewallState.toolCallCounts[toolName] = callCount;
    const loopCount = Math.max(0, ...Object.values(context?.eventCounts ?? {}));
    return this.localPolicyEvaluator.evaluate(
      this.runtimeConfig.getPolicies(),
      {
        toolName,
        input,
        output,
        metadata: options,
        state: {
          callCount,
          totalCost: firewallState?.totalCost ?? 0,
          elapsedMs: firewallState ? Date.now() - firewallState.startedAt : 0,
          loopCount,
        },
      },
    );
  }

  /** Enqueues a policy detection for asynchronous server-side issue review. */
  private reportPolicyDetection(
    toolName: string,
    evaluatedValue: unknown,
    decision: LynxPolicyDecision & {
      action: LynxPolicyAction;
      allow: boolean;
    },
    phase: "TOOL_INPUT" | "INPUT" | "OUTPUT" = "TOOL_INPUT",
  ): void {
    if (decision.action === "ALLOW") return;
    const context = LynxTracer.storage.getStore();
    if (!context) return;
    const promptVersionIds = this.getPinnedPromptVersionIds(context);
    const promptVersionId =
      promptVersionIds.length === 1 ? promptVersionIds[0] : undefined;
    const agentId = context.agentId ?? context.agentName;
    const argsHash = createStableHash(evaluatedValue);
    const detectionType =
      decision.action === "WARN" ? "FIREWALL_WARN" : "FIREWALL_BLOCK";
    const payload = {
      toolName,
      action: decision.action,
      reason: decision.reason,
      severity: decision.severity,
      policyName:
        typeof decision.metadata?.policyName === "string"
          ? decision.metadata.policyName
          : undefined,
      condition:
        typeof decision.metadata?.condition === "string"
          ? decision.metadata.condition
          : undefined,
      phase,
      argsHash,
    };
    const evidence = {
      spanId: context.spanId,
      policyVersion: decision.policyVersion,
      managedPolicy: decision.metadata?.managedPolicy === true,
      promptVersionIds:
        promptVersionIds.length > 0 ? promptVersionIds : undefined,
    };
    this.issueReporter.report({
      sdkInstanceId: this.config.clientId,
      clientRecordId: generateEventId(),
      recordKind: "DETECTION",
      detectionType,
      runId: context.runId,
      sessionId: context.sessionId,
      agentId,
      policyId: decision.policyId,
      promptVersionId,
      detectedAt: Date.now(),
      payload,
      evidence,
    });
    if (
      decision.action !== "WARN" &&
      this.isIssueReportingEnabled() &&
      context.issueState
    ) {
      context.issueState.specificFailureReported = true;
    }
    this.rememberDetection(
      this.createPolicyDetectionKey(agentId, phase, toolName, argsHash),
      {
        detectionType,
        agentId,
        policyId: decision.policyId,
        promptVersionId,
        payload,
        evidence,
        healthyObservations: 0,
      },
    );
  }

  /** Reports an unhandled root-run exception unless a more specific cause exists. */
  private reportRunFailure(
    eventId: string,
    payload: Record<string, unknown>,
    context: LynxContext,
  ): void {
    if (
      !this.isIssueReportingEnabled() ||
      this.config.issueReporting?.reportRunFailures === false ||
      payload.suppressRunIssue === true ||
      context.issueState?.specificFailureReported
    ) {
      return;
    }
    const errorSignature = this.readPayloadString(payload.errorSignature);
    if (
      errorSignature &&
      this.hasReportedErrorSignature(errorSignature, context)
    ) {
      return;
    }

    const errorCode = normalizeErrorCode(payload.errorCode, "RUN_ERROR");
    const promptVersionIds = this.getPinnedPromptVersionIds(context);
    const promptVersionId =
      promptVersionIds.length === 1 ? promptVersionIds[0] : undefined;
    const agentId = context.agentId ?? context.agentName;
    const issuePayload = {
      agentName: context.agentName,
      errorName: payload.errorName,
      errorCode,
      errorSignature,
      errorMessage: payload.error,
      latency: payload.latency,
      riskSignals: ["RUN_ERROR"],
    };
    const evidence = {
      spanId: payload.spanId,
      parentSpanId: payload.parentSpanId,
      promptVersionIds:
        promptVersionIds.length > 0 ? promptVersionIds : undefined,
    };

    this.issueReporter.report({
      sdkInstanceId: this.config.clientId,
      clientRecordId: generateEventId(),
      recordKind: "DETECTION",
      detectionType: "RUN_ERROR",
      runId: context.runId,
      sessionId: context.sessionId,
      eventId,
      agentId,
      promptVersionId,
      detectedAt: Date.now(),
      payload: issuePayload,
      evidence,
    });
    if (errorSignature) {
      this.rememberReportedErrorSignature(errorSignature, context);
    }
    this.rememberDetection(
      `run-failure:${agentId}:RUN_ERROR:${errorSignature ?? errorCode}`,
      {
        detectionType: "RUN_ERROR",
        agentId,
        promptVersionId,
        payload: issuePayload,
        evidence,
        healthyObservations: 0,
      },
    );
  }

  /** Reports a failed technical or business outcome that did not throw. */
  private reportFailedOutcome(
    eventId: string | undefined,
    options: LynxOutcomeOptions,
    context: LynxContext,
  ): void {
    if (
      !this.isIssueReportingEnabled() ||
      this.config.issueReporting?.reportRunFailures === false ||
      context.issueState?.specificFailureReported ||
      context.issueState?.failedOutcomeReported
    ) {
      return;
    }

    const metadataReasonCode =
      typeof options.metadata?.reasonCode === "string"
        ? options.metadata.reasonCode
        : undefined;
    const reasonCode = normalizeErrorCode(
      metadataReasonCode,
      options.status === "FAILED"
        ? "TECHNICAL_FAILURE"
        : "BUSINESS_FAILURE",
    );
    const promptVersionIds = this.getPinnedPromptVersionIds(context);
    const promptVersionId =
      promptVersionIds.length === 1 ? promptVersionIds[0] : undefined;
    const agentId = context.agentId ?? context.agentName;
    const issuePayload = {
      agentName: context.agentName,
      status: options.status,
      businessStatus: options.businessStatus,
      reasonCode,
      reason: options.reason?.slice(0, 1_000),
      userImpact: options.userImpact,
      riskSignals: ["RUN_FAILED"],
    };
    const evidence = {
      spanId: context.spanId,
      parentSpanId: context.parentSpanId,
      promptVersionIds:
        promptVersionIds.length > 0 ? promptVersionIds : undefined,
    };

    this.issueReporter.report({
      sdkInstanceId: this.config.clientId,
      clientRecordId: generateEventId(),
      recordKind: "DETECTION",
      detectionType: "RUN_FAILED",
      runId: context.runId,
      sessionId: context.sessionId,
      eventId,
      agentId,
      promptVersionId,
      detectedAt: Date.now(),
      payload: issuePayload,
      evidence,
    });
    if (context.issueState) {
      context.issueState.failedOutcomeReported = true;
    }
    this.rememberDetection(
      `run-failure:${agentId}:RUN_FAILED:${reasonCode}`,
      {
        detectionType: "RUN_FAILED",
        agentId,
        promptVersionId,
        payload: issuePayload,
        evidence,
        healthyObservations: 0,
      },
    );
  }

  /** Counts a successful root run toward recovery for active run failures. */
  private reportRunRecovery(context: LynxContext): void {
    if (!this.isIssueReportingEnabled()) return;
    const agentId = context.agentId ?? context.agentName;
    const prefix = `run-failure:${agentId}:`;
    for (const key of [...this.activeDetections.keys()]) {
      if (key.startsWith(prefix)) this.observeHealthyDetection(key, context);
    }
  }

  /** Reports a provider error captured by an instrumented LLM wrapper. */
  private reportLlmFailure(
    eventId: string,
    payload: Record<string, unknown>,
    context: LynxContext,
  ): void {
    if (
      !this.isIssueReportingEnabled() ||
      this.config.issueReporting?.reportLlmFailures === false
    ) {
      return;
    }
    const errorSignature = this.readPayloadString(payload.errorSignature);
    const errorCode = normalizeErrorCode(payload.errorCode, "LLM_ERROR");
    const identity = this.createLlmIdentity(payload);
    const promptVersionIds = this.getPinnedPromptVersionIds(context);
    const promptVersionId =
      promptVersionIds.length === 1 ? promptVersionIds[0] : undefined;
    const agentId = context.agentId ?? context.agentName;
    const issuePayload = {
      modelLabel: payload.modelLabel,
      provider: payload.provider,
      model: payload.model,
      path: payload.path,
      errorName: payload.errorName,
      errorCode,
      errorSignature,
      errorMessage: payload.error,
      latency: payload.latency,
      riskSignals: ["LLM_ERROR"],
    };
    const evidence = {
      spanId: payload.spanId,
      parentSpanId: payload.parentSpanId,
      promptVersionIds:
        promptVersionIds.length > 0 ? promptVersionIds : undefined,
    };

    this.issueReporter.report({
      sdkInstanceId: this.config.clientId,
      clientRecordId: generateEventId(),
      recordKind: "DETECTION",
      detectionType: "LLM_ERROR",
      runId: context.runId,
      sessionId: context.sessionId,
      eventId,
      agentId,
      promptVersionId,
      detectedAt: Date.now(),
      payload: issuePayload,
      evidence,
    });
    if (context.issueState) {
      context.issueState.specificFailureReported = true;
    }
    if (errorSignature) {
      this.rememberReportedErrorSignature(errorSignature, context);
    }
    this.rememberDetection(
      `llm-error:${agentId}:${identity}:${errorSignature ?? errorCode}`,
      {
        detectionType: "LLM_ERROR",
        agentId,
        promptVersionId,
        payload: issuePayload,
        evidence,
        healthyObservations: 0,
      },
    );
  }

  /** Evaluates one completed LLM call for recovery and abnormal latency. */
  private reportLlmObservation(
    eventId: string,
    payload: Record<string, unknown>,
    context: LynxContext,
  ): void {
    if (!this.isIssueReportingEnabled()) return;
    const identity = this.createLlmIdentity(payload);
    const agentId = context.agentId ?? context.agentName;
    const errorPrefix = `llm-error:${agentId}:${identity}:`;
    for (const key of [...this.activeDetections.keys()]) {
      if (key.startsWith(errorPrefix)) {
        this.observeHealthyDetection(key, context);
      }
    }

    const slowKey = `llm-slow:${agentId}:${identity}`;
    const thresholdMs = this.resolveSlowLlmThreshold(payload);
    const latency = this.readPayloadNumber(payload.latency);
    if (
      payload.reportSlowResponse === false ||
      thresholdMs <= 0 ||
      latency === undefined
    ) {
      this.slowLlmObservations.delete(slowKey);
      return;
    }
    if (latency < thresholdMs) {
      this.slowLlmObservations.delete(slowKey);
      this.observeHealthyDetection(slowKey, context);
      return;
    }

    if (
      !this.slowLlmObservations.has(slowKey) &&
      this.slowLlmObservations.size >= MAX_ACTIVE_DETECTIONS
    ) {
      const oldestKey = this.slowLlmObservations.keys().next().value;
      if (typeof oldestKey === "string") {
        this.slowLlmObservations.delete(oldestKey);
      }
    }
    const observationCount = (this.slowLlmObservations.get(slowKey) ?? 0) + 1;
    this.slowLlmObservations.set(slowKey, observationCount);
    const configuredOccurrences =
      this.config.issueReporting?.slowLlmConsecutiveOccurrences;
    const requiredOccurrences =
      typeof configuredOccurrences === "number" &&
      Number.isFinite(configuredOccurrences) &&
      configuredOccurrences > 0
        ? Math.floor(configuredOccurrences)
        : DEFAULT_SLOW_LLM_CONSECUTIVE_OCCURRENCES;
    if (observationCount < requiredOccurrences) return;

    const promptVersionIds = this.getPinnedPromptVersionIds(context);
    const promptVersionId =
      promptVersionIds.length === 1 ? promptVersionIds[0] : undefined;
    const issuePayload = {
      modelLabel: payload.modelLabel,
      provider: payload.provider,
      model: payload.model,
      path: payload.path,
      latency,
      thresholdMs,
      consecutiveOccurrences: observationCount,
      riskSignals: ["LLM_SLOW_RESPONSE"],
    };
    const evidence = {
      spanId: payload.spanId,
      parentSpanId: payload.parentSpanId,
      promptVersionIds:
        promptVersionIds.length > 0 ? promptVersionIds : undefined,
    };

    this.issueReporter.report({
      sdkInstanceId: this.config.clientId,
      clientRecordId: generateEventId(),
      recordKind: "DETECTION",
      detectionType: "LLM_SLOW_RESPONSE",
      runId: context.runId,
      sessionId: context.sessionId,
      eventId,
      agentId,
      promptVersionId,
      detectedAt: Date.now(),
      payload: issuePayload,
      evidence,
    });
    this.rememberDetection(slowKey, {
      detectionType: "LLM_SLOW_RESPONSE",
      agentId,
      promptVersionId,
      payload: issuePayload,
      evidence,
      healthyObservations: 0,
    });
  }

  /** Reports one instrumented tool failure for asynchronous server review. */
  private reportToolFailure(
    eventId: string,
    payload: Record<string, unknown>,
    context: LynxContext,
  ): void {
    if (!this.isIssueReportingEnabled()) return;
    const toolName =
      typeof payload.toolName === "string" && payload.toolName
        ? payload.toolName
        : undefined;
    if (!toolName) return;

    const isTimeout = payload.toolTimedOut === true;
    const detectionType = isTimeout ? "TOOL_TIMEOUT" : "TOOL_ERROR";
    const errorCode = this.normalizeToolErrorCode(
      payload.errorCode,
      isTimeout ? "LYNX_TOOL_TIMEOUT" : "TOOL_ERROR",
    );
    const promptVersionIds = this.getPinnedPromptVersionIds(context);
    const promptVersionId =
      promptVersionIds.length === 1 ? promptVersionIds[0] : undefined;
    const agentId = context.agentId ?? context.agentName;
    const issuePayload = {
      toolName,
      toolVersion: payload.toolVersion,
      errorName: payload.errorName,
      errorCode,
      errorSignature: payload.errorSignature,
      errorMessage:
        typeof payload.error === "string"
          ? payload.error.slice(0, 1_000)
          : undefined,
      argsHash: payload.argsHash,
      latency: payload.latency,
      timeoutMs: payload.timeoutMs,
      retryCount: payload.retryCount,
      sideEffect: payload.sideEffect,
      riskLevel: payload.riskLevel,
      externalTarget: payload.externalTarget,
      errorIsRethrown: true,
      riskSignals: [detectionType],
      tools: [toolName],
    };
    const evidence = {
      spanId: payload.spanId,
      parentSpanId: payload.parentSpanId,
      promptVersionIds:
        promptVersionIds.length > 0 ? promptVersionIds : undefined,
    };

    this.issueReporter.report({
      sdkInstanceId: this.config.clientId,
      clientRecordId: generateEventId(),
      recordKind: "DETECTION",
      detectionType,
      runId: context.runId,
      sessionId: context.sessionId,
      eventId,
      agentId,
      promptVersionId,
      detectedAt: Date.now(),
      payload: issuePayload,
      evidence,
    });
    if (context.issueState) {
      context.issueState.specificFailureReported = true;
    }
    const errorSignature = this.readPayloadString(payload.errorSignature);
    if (errorSignature) {
      this.rememberReportedErrorSignature(errorSignature, context);
    }
    this.rememberDetection(
      this.createToolFailureDetectionKey(
        agentId,
        toolName,
        detectionType,
        errorCode,
      ),
      {
        detectionType,
        agentId,
        promptVersionId,
        payload: issuePayload,
        evidence,
        healthyObservations: 0,
      },
    );
  }

  /** Counts a successful call toward recovery for all failures of one tool. */
  private reportToolRecovery(
    payload: Record<string, unknown>,
    context: LynxContext,
  ): void {
    const toolName =
      typeof payload.toolName === "string" && payload.toolName
        ? payload.toolName
        : undefined;
    if (!toolName) return;
    const agentId = context.agentId ?? context.agentName;
    const prefix = `tool-failure:${agentId}:${toolName}:`;
    for (const key of [...this.activeDetections.keys()]) {
      if (key.startsWith(prefix)) this.observeHealthyDetection(key, context);
    }
  }

  /** Creates a local correlation key without using variable error messages. */
  private createToolFailureDetectionKey(
    agentId: string,
    toolName: string,
    detectionType: string,
    errorCode: string,
  ): string {
    return `tool-failure:${agentId}:${toolName}:${detectionType}:${errorCode}`;
  }

  /** Normalizes an error code before it enters issue grouping. */
  private normalizeToolErrorCode(value: unknown, fallback: string): string {
    return normalizeErrorCode(value, fallback);
  }

  /** Returns whether issue records can be created and delivered. */
  private isIssueReportingEnabled(): boolean {
    return (
      this.config.issueReporting?.enabled === true &&
      Boolean(this.config.apiKey)
    );
  }

  /** Returns whether the explicit outcome already describes a failed run. */
  private hasFailedOutcome(context: LynxContext): boolean {
    return (
      context.outcomeState?.lastStatus === "FAILED" ||
      context.outcomeState?.lastBusinessStatus === "FAILED"
    );
  }

  /** Creates a stable local identity for one model call configuration. */
  private createLlmIdentity(payload: Record<string, unknown>): string {
    return createStableHash({
      modelLabel: this.readPayloadString(payload.modelLabel) ?? "llm.inference",
      provider: this.readPayloadString(payload.provider) ?? "unknown",
      model: this.readPayloadString(payload.model) ?? "unknown",
    });
  }

  /** Resolves a per-wrapper latency threshold before the global default. */
  private resolveSlowLlmThreshold(
    payload: Record<string, unknown>,
  ): number {
    const override = this.readPayloadNumber(payload.slowResponseThresholdMs);
    const configured =
      override ??
      this.config.issueReporting?.slowLlmThresholdMs ??
      DEFAULT_SLOW_LLM_THRESHOLD_MS;
    return Number.isFinite(configured) ? Math.max(0, configured) : 0;
  }

  /** Reads a non-empty string from an instrumentation payload. */
  private readPayloadString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  /** Reads a finite number from an instrumentation payload. */
  private readPayloadNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value)
      ? value
      : undefined;
  }

  /** Returns whether a more specific detector already reported this error. */
  private hasReportedErrorSignature(
    signature: string,
    context: LynxContext,
  ): boolean {
    return (
      context.issueState?.reportedErrorSignatures.includes(signature) ?? false
    );
  }

  /** Retains a bounded set of error signatures for root-run deduplication. */
  private rememberReportedErrorSignature(
    signature: string,
    context: LynxContext,
  ): void {
    const signatures = context.issueState?.reportedErrorSignatures;
    if (!signatures || signatures.includes(signature)) return;
    signatures.push(signature);
    if (signatures.length > MAX_REPORTED_ERROR_SIGNATURES) {
      signatures.splice(0, signatures.length - MAX_REPORTED_ERROR_SIGNATURES);
    }
  }

  /** Counts a healthy policy observation toward recovery. */
  private reportPolicyRecovery(
    toolName: string,
    evaluatedValue: unknown,
    phase: "TOOL_INPUT" | "INPUT" | "OUTPUT",
  ): void {
    const context = LynxTracer.storage.getStore();
    if (!context) return;
    const agentId = context.agentId ?? context.agentName;
    const argsHash = createStableHash(evaluatedValue);
    this.observeHealthyDetection(
      this.createPolicyDetectionKey(agentId, phase, toolName, argsHash),
      context,
    );
  }

  /** Builds the local correlation key used before server fingerprinting. */
  private createPolicyDetectionKey(
    agentId: string,
    phase: "TOOL_INPUT" | "INPUT" | "OUTPUT",
    toolName: string,
    argsHash: string,
  ): string {
    return `policy:${agentId}:${phase}:${toolName}:${argsHash}`;
  }

  /** Retains a bounded set of detections that may later recover. */
  private rememberDetection(key: string, detection: ActiveDetection): void {
    if (
      !this.activeDetections.has(key) &&
      this.activeDetections.size >= MAX_ACTIVE_DETECTIONS
    ) {
      const oldestKey = this.activeDetections.keys().next().value;
      if (typeof oldestKey === "string")
        this.activeDetections.delete(oldestKey);
    }
    this.activeDetections.set(key, detection);
  }

  /** Emits one recovery after enough consecutive healthy observations. */
  private observeHealthyDetection(key: string, context: LynxContext): void {
    const detection = this.activeDetections.get(key);
    if (!detection) return;
    detection.healthyObservations += 1;
    const threshold = Math.max(
      1,
      this.config.issueReporting?.recoverySuccessThreshold ?? 3,
    );
    if (detection.healthyObservations < threshold) return;

    this.issueReporter.report({
      sdkInstanceId: this.config.clientId,
      clientRecordId: generateEventId(),
      recordKind: "RECOVERY",
      detectionType: detection.detectionType,
      runId: context.runId,
      sessionId: context.sessionId,
      agentId: detection.agentId,
      policyId: detection.policyId,
      promptVersionId: detection.promptVersionId,
      detectedAt: Date.now(),
      payload: {
        ...detection.payload,
        recovered: true,
        healthyObservationCount: detection.healthyObservations,
      },
      evidence: {
        ...detection.evidence,
        recoverySpanId: context.spanId,
      },
    });
    this.activeDetections.delete(key);
  }

  /** Returns unique prompt versions instead of alias-expanded duplicates. */
  private getPinnedPromptVersionIds(context: LynxContext): string[] {
    return [
      ...new Set(
        Object.values(context.promptVersions ?? {}).map(
          (prompt) => prompt.versionId,
        ),
      ),
    ].sort();
  }

  /** Returns one non-sensitive experiment exposure per prompt in the run. */
  private getPromptExposures(context: LynxContext): LynxPromptExposure[] {
    const exposures = new Map<string, LynxPromptExposure>();
    for (const prompt of Object.values(context.promptVersions ?? {})) {
      if (!prompt.experiment) continue;
      const exposure: LynxPromptExposure = {
        experimentId: prompt.experiment.experimentId,
        promptId: prompt.promptId,
        promptVersionId: prompt.versionId,
        bucket: prompt.experiment.bucket,
        runtimeConfigRevision: prompt.experiment.runtimeConfigRevision,
      };
      exposures.set(`${exposure.experimentId}:${exposure.promptId}`, exposure);
    }
    return [...exposures.values()];
  }

  /**
   * Applies managed firewall policies to user or model input content.
   *
   * String content is available to policy expressions as both `input` and
   * `input.value`. A matching BLOCK or REQUIRE_APPROVAL decision throws before
   * the caller continues to the model.
   *
   * @param input User, prompt, or model request content to evaluate locally.
   * @param options Content boundary label and policy failure behavior.
   * @returns The strongest managed policy decision.
   * @throws {LynxPolicyError} When a managed policy blocks the content.
   */
  firewallInput(
    input: unknown,
    options: LynxFirewallContentOptions = {},
  ): LynxPolicyDecision {
    return this.enforceManagedContentPolicy("INPUT", input, options);
  }

  /**
   * Applies managed firewall policies to generated model output.
   *
   * String content is available to policy expressions as both `output` and
   * `output.value`. A matching BLOCK or REQUIRE_APPROVAL decision throws before
   * the application returns the generated content to its user.
   *
   * @param output Generated model content to evaluate locally.
   * @param options Content boundary label and policy failure behavior.
   * @returns The strongest managed policy decision.
   * @throws {LynxPolicyError} When a managed policy blocks the content.
   */
  firewallOutput(
    output: unknown,
    options: LynxFirewallContentOptions = {},
  ): LynxPolicyDecision {
    return this.enforceManagedContentPolicy("OUTPUT", output, options);
  }

  /** Evaluates, records, and enforces one managed content policy boundary. */
  private enforceManagedContentPolicy(
    phase: "INPUT" | "OUTPUT",
    value: unknown,
    options: LynxFirewallContentOptions,
  ): LynxPolicyDecision & { action: LynxPolicyAction; allow: boolean } {
    const label =
      options.label ?? (phase === "INPUT" ? "llm.input" : "llm.output");
    const metadata: LynxToolMetadata = {
      riskLevel: options.riskLevel,
      failureMode: options.failureMode,
    };
    let decision: LynxPolicyDecision & {
      action: LynxPolicyAction;
      allow: boolean;
    };

    try {
      decision = this.normalizePolicyDecision(
        this.evaluateManagedPolicies(
          label,
          phase === "INPUT" ? value : undefined,
          metadata,
          phase === "OUTPUT" ? value : undefined,
        ),
      );
    } catch (error) {
      decision = this.decisionFromPolicyError(error, metadata);
    }

    const contentKey = phase === "INPUT" ? "input" : "output";
    const content =
      options.captureContent === false
        ? { [contentKey]: { redacted: true } }
        : { [contentKey]: value };
    this.capture("POLICY_EVALUATION", `policy:${label}`, {
      ...content,
      phase,
      toolName: label,
      valueHash: createStableHash(value),
      action: decision.action,
      allow: decision.allow,
      policyId: decision.policyId,
      policyVersion: decision.policyVersion,
      reason: decision.reason,
      severity: decision.severity,
      metadata: decision.metadata,
    });
    this.reportPolicyDetection(label, value, decision, phase);

    if (decision.allow) {
      if (decision.action === "ALLOW") {
        this.reportPolicyRecovery(label, value, phase);
      }
      return decision;
    }

    this.capture("POLICY_VIOLATION", `policy.violation:${label}`, {
      ...content,
      phase,
      toolName: label,
      valueHash: createStableHash(value),
      action: decision.action,
      policyId: decision.policyId,
      policyVersion: decision.policyVersion,
      reason: decision.reason,
      severity: decision.severity ?? options.riskLevel,
    });
    this.capture("FIREWALL_ACTIVATED", `firewall.blocked:${label}`, {
      phase,
      toolName: label,
      action: decision.action,
      reason: decision.reason,
      riskLevel: decision.severity ?? options.riskLevel,
    });
    throw new LynxPolicyError(
      decision.reason || `Lynx firewall blocked ${phase.toLowerCase()} content`,
      decision.action === "REQUIRE_APPROVAL" ? "REQUIRE_APPROVAL" : "BLOCK",
      decision.policyId,
      decision.severity ?? options.riskLevel,
      decision.reason,
      decision.metadata,
    );
  }

  /**
   * Wraps a tool with a local policy check before execution.
   *
   * `firewallTool()` emits a `POLICY_EVALUATION` event before the tool runs. When
   * `beforeCall` returns `{ allow: false }`, Lynx also emits
   * `POLICY_VIOLATION` and the legacy `FIREWALL_ACTIVATED` wire event, then
   * throws before executing
   * the original tool. This provides the SDK-side hook needed for "observe first,
   * then prevent recurrence" workflows.
   *
   * @typeParam T Tool function type.
   * @param toolName Stable tool name shown in traces and policy events.
   * @param fn Tool function to protect.
   * @param options Tool metadata and an optional `beforeCall` policy callback.
   * @returns A protected function with the same call signature as `fn`.
   */
  firewallTool<T extends (...args: any[]) => any>(
    toolName: string,
    fn: T,
    options: LynxFirewallToolOptions<Parameters<T>> = {},
  ): T {
    const guarded = (async (...args: Parameters<T>) => {
      const input = args[0];
      let decision: LynxPolicyDecision & {
        action: LynxPolicyAction;
        allow: boolean;
      };

      try {
        const managedDecision = this.evaluateManagedPolicies(
          toolName,
          input,
          options,
        );
        const applicationDecision = options.beforeCall
          ? await options.beforeCall({
              toolName,
              input,
              args,
              metadata: options,
            })
          : ({ action: "ALLOW" } satisfies LynxPolicyDecision);
        decision = this.selectPolicyDecision([
          managedDecision,
          applicationDecision,
        ]);
      } catch (err) {
        decision = this.decisionFromPolicyError(err, options);
      }

      this.capture("POLICY_EVALUATION", `policy:${toolName}`, {
        toolName,
        input,
        args,
        argsHash: createStableHash(input),
        action: decision.action,
        allow: decision.allow,
        policyId: decision.policyId,
        policyVersion:
          decision.policyVersion ??
          options.policyVersion ??
          this.config.policyVersion,
        reason: decision.reason,
        severity: decision.severity,
        metadata: decision.metadata,
      });
      this.reportPolicyDetection(toolName, input, decision);

      if (
        decision.action === "REQUIRE_APPROVAL" &&
        this.config.approval?.enabled === true
      ) {
        const context = LynxTracer.storage.getStore();
        if (!context) {
          throw new LynxPolicyError(
            "Lynx approval requires an active run context",
            "REQUIRE_APPROVAL",
            decision.policyId,
            decision.severity,
            decision.reason,
          );
        }
        let approval;
        try {
          approval = await this.approvalClient.request(
            {
              clientRequestId: generateEventId(),
              runId: context.runId,
              sessionId: context.sessionId ?? `session_${context.runId}`,
              agentId: context.agentId ?? context.agentName,
              policyId: decision.policyId,
              toolName,
              inputHash: createStableHash(input),
              reason: decision.reason,
            },
            context.signal,
          );
        } catch (error) {
          throw new LynxPolicyError(
            error instanceof Error
              ? `Lynx approval failed: ${error.message}`
              : "Lynx approval failed",
            "REQUIRE_APPROVAL",
            decision.policyId,
            decision.severity,
            decision.reason,
            decision.metadata,
          );
        }
        this.capture("AGENT_DECISION", `approval:${toolName}`, {
          approvalId: approval.id,
          approvalStatus: approval.status,
          policyId: decision.policyId,
          toolName,
          reason: approval.decisionReason,
        });
        if (approval.status === "APPROVED") {
          decision = {
            ...decision,
            action: "ALLOW",
            allow: true,
            metadata: {
              ...decision.metadata,
              approvalId: approval.id,
              approved: true,
            },
          };
        } else {
          decision = {
            ...decision,
            reason:
              approval.decisionReason ??
              `Lynx approval ${approval.status.toLowerCase()}`,
          };
        }
      }

      if (!decision.allow) {
        this.capture("POLICY_VIOLATION", `policy.violation:${toolName}`, {
          toolName,
          input,
          args,
          argsHash: createStableHash(input),
          action: decision.action,
          policyId: decision.policyId,
          policyVersion:
            decision.policyVersion ??
            options.policyVersion ??
            this.config.policyVersion,
          reason: decision.reason,
          severity: decision.severity ?? options.riskLevel,
        });
        // Keep the established wire identifier for backward-compatible ingestion.
        this.capture("FIREWALL_ACTIVATED", `firewall.blocked:${toolName}`, {
          toolName,
          action: decision.action,
          reason: decision.reason,
          riskLevel: decision.severity ?? options.riskLevel,
        });
        throw new LynxPolicyError(
          decision.reason || `Lynx firewall blocked tool call: ${toolName}`,
          decision.action === "REQUIRE_APPROVAL" ? "REQUIRE_APPROVAL" : "BLOCK",
          decision.policyId,
          decision.severity ?? options.riskLevel,
          decision.reason,
          decision.metadata,
        );
      }

      if (decision.action === "ALLOW") {
        this.reportPolicyRecovery(toolName, input, "TOOL_INPUT");
      }
      const instrumented = this.instrumentTool(toolName, fn, options);
      return instrumented(...args);
    }) as unknown as T;

    return guarded;
  }

  /**
   * @deprecated Use `firewallTool()`.
   */
  guardTool<T extends (...args: any[]) => any>(
    toolName: string,
    fn: T,
    options: LynxFirewallToolOptions<Parameters<T>> = {},
  ): T {
    return this.firewallTool(toolName, fn, options);
  }

  private detectLoop(
    eventType: LynxEventDto["eventType"],
    label: string,
    payload: any,
    context: LynxContext,
  ): Partial<LynxEventDto["payload"]> {
    if (
      eventType !== "TOOL_CALL" &&
      eventType !== "CALL_TOOLS" &&
      eventType !== "LLM_CALL"
    ) {
      return {};
    }

    // Instrumented calls produce start and end events with the same label and
    // arguments. Count only starts or one logical call would be counted twice.
    const phase = payload?.phase;
    if (phase && phase !== "start") {
      return {};
    }

    // The key includes arguments, so normal repeated use of one tool with
    // different inputs does not look like a runaway loop.
    const argsHash = createStableHash(
      payload?.args ?? payload?.input ?? payload?.model ?? label,
    );
    const key = `${eventType}:${label}:${argsHash}`;
    context.eventCounts ??= {};
    const loopCount = (context.eventCounts[key] ?? 0) + 1;
    context.eventCounts[key] = loopCount;

    const agentId = context.agentId ?? context.agentName;
    const detectionKey = `loop:${agentId}:${eventType}:${label}:${argsHash}`;
    if (loopCount < 5) {
      this.observeHealthyDetection(detectionKey, context);
      return { argsHash };
    }

    if (loopCount === 5) {
      const promptVersionIds = this.getPinnedPromptVersionIds(context);
      const promptVersionId =
        promptVersionIds.length === 1 ? promptVersionIds[0] : undefined;
      const detectionPayload = {
        eventType,
        label,
        argsHash,
        loopCount,
      };
      const detectionEvidence = {
        spanId: context.spanId,
        parentSpanId: context.parentSpanId,
        promptVersionIds:
          promptVersionIds.length > 0 ? promptVersionIds : undefined,
      };
      this.issueReporter.report({
        sdkInstanceId: this.config.clientId,
        clientRecordId: generateEventId(),
        recordKind: "DETECTION",
        detectionType: "LOOP_DETECTED",
        runId: context.runId,
        sessionId: context.sessionId,
        agentId,
        promptVersionId,
        detectedAt: Date.now(),
        payload: detectionPayload,
        evidence: detectionEvidence,
      });
      this.rememberDetection(detectionKey, {
        detectionType: "LOOP_DETECTED",
        agentId,
        promptVersionId,
        payload: detectionPayload,
        evidence: detectionEvidence,
        healthyObservations: 0,
      });
    }

    return {
      argsHash,
      loopDetected: true,
      loopCount,
      repeatedLabel: label,
    };
  }
}
