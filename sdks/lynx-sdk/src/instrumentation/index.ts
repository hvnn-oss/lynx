import {
  LynxLlmFirewallBoundaryOptions,
  LynxLlmInstrumentationOptions,
  LynxToolMetadata,
} from "../core/types.js";
import { generateSpanId } from "../utils/id.js";
import { extractTokenUsage } from "../utils/usage.js";
import { LynxPolicyError, LynxTracer } from "../core/tracer.js";
import { createStableHash } from "../utils/stable-hash.js";
import { readErrorDetails } from "../utils/error-details.js";

const MAX_TOOL_TIMEOUT_MS = 2_147_483_647;

/** Error raised when an instrumented asynchronous tool exceeds its deadline. */
export class LynxToolTimeoutError extends Error {
  readonly code = "LYNX_TOOL_TIMEOUT";

  constructor(
    readonly toolName: string,
    readonly timeoutMs: number,
  ) {
    super(`Tool "${toolName}" did not finish within ${timeoutMs}ms`);
    this.name = "LynxToolTimeoutError";
  }
}

function getProvider(path: string[], model?: string): string {
  const pathStr = path.join(".");
  if (pathStr.includes("messages.create")) return "anthropic";
  if (pathStr.includes("generateContent")) return "google";
  if (pathStr.includes("generateText") || pathStr.includes("streamText"))
    return "vercel-ai";
  if (pathStr.includes("ollama")) return "ollama";
  if (pathStr.includes("cohere")) return "cohere";
  if (model?.toLowerCase().includes("claude")) return "anthropic";
  if (model?.toLowerCase().includes("gemini")) return "google";
  return "openai";
}

function getMessages(input: any): any[] | undefined {
  if (Array.isArray(input?.messages)) return input.messages;
  if (Array.isArray(input?.contents)) return input.contents;
  if (Array.isArray(input?.prompt)) return input.prompt;
  return undefined;
}

function getTextLength(data: any): number {
  if (data === undefined || data === null) return 0;
  if (typeof data === "string") return data.length;
  try {
    return JSON.stringify(data).length;
  } catch {
    return 0;
  }
}

function extractLlmMetadata(input: any, path: string[]) {
  const messages = getMessages(input);
  const systemMessage = messages?.find((item) => item?.role === "system");
  const userMessage = [...(messages ?? [])]
    .reverse()
    .find((item) => item?.role === "user");
  const model = input?.model ?? input?.modelName;
  const maxTokens =
    input?.max_tokens ?? input?.maxTokens ?? input?.maxOutputTokens;

  return {
    provider: getProvider(path, model),
    model,
    temperature: input?.temperature,
    topP: input?.top_p ?? input?.topP,
    maxTokens,
    seed: input?.seed,
    promptVersion: input?.promptVersion,
    systemPromptHash: systemMessage
      ? createStableHash(systemMessage)
      : undefined,
    userPromptHash: userMessage ? createStableHash(userMessage) : undefined,
    messageCount: messages?.length,
    contextLength: getTextLength(input),
  };
}

function summarizeResult(result: any): string | undefined {
  if (result === undefined || result === null) return undefined;
  if (typeof result === "string") return result.slice(0, 240);
  if (typeof result === "number" || typeof result === "boolean")
    return String(result);
  try {
    return JSON.stringify(result).slice(0, 240);
  } catch {
    return "[Unserializable Result]";
  }
}

function isPromiseLike<T = unknown>(value: unknown): value is PromiseLike<T> {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof (value as PromiseLike<T>).then === "function"
  );
}

/** Returns one safe timer duration or undefined when timeout is disabled. */
function resolveToolTimeoutMs(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.min(MAX_TOOL_TIMEOUT_MS, Math.floor(value));
}

/** Rejects the wrapper deadline without claiming to cancel underlying work. */
function waitForToolWithin<T>(
  work: Promise<T>,
  toolName: string,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new LynxToolTimeoutError(toolName, timeoutMs)),
      timeoutMs,
    );
    work.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof (value as AsyncIterable<unknown>)[Symbol.asyncIterator] ===
      "function"
  );
}

function wrapAsyncIterable<T extends AsyncIterable<unknown>>(
  source: T,
  onComplete: () => void,
  onError: (error: unknown) => void,
  onChunk?: (chunk: unknown) => void,
): T {
  let isSettled = false;
  const settleComplete = () => {
    if (isSettled) return;
    isSettled = true;
    onComplete();
  };
  const settleError = (error: unknown) => {
    if (isSettled) return;
    isSettled = true;
    onError(error);
  };

  return new Proxy(source, {
    get(target, property, receiver) {
      if (property !== Symbol.asyncIterator) {
        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      }
      return async function* () {
        try {
          for await (const chunk of target) {
            onChunk?.(chunk);
            yield chunk;
          }
          settleComplete();
        } catch (error) {
          settleError(error);
          throw error;
        }
      };
    },
  });
}

function createChildContext(
  context: ReturnType<typeof LynxTracer.getStore>,
  spanId: string,
) {
  if (!context) return undefined;
  return {
    ...context,
    spanId,
    parentSpanId: context.spanId,
  };
}

/**
 * Wraps an LLM client object with Lynx telemetry instrumentation.
 *
 * This low-level helper is used by `LynxTracer.instrumentLLM()`. It returns a
 * recursive proxy that preserves the original client API and intercepts known
 * generation methods. Each intercepted call emits start/end `LLM_CALL` events,
 * token usage when available, model configuration metadata, latency, span ids,
 * and errors.
 *
 * Most application code should call `lynx.instrumentLLM(client, options)`
 * instead of importing this helper directly.
 *
 * @typeParam T LLM client object type.
 * @param tracer Tracer that receives captured telemetry.
 * @param instance LLM client instance to wrap.
 * @param optionsOrLabel Event label or custom extraction/interception rules.
 * @returns A proxy with the same public shape as `instance`.
 */
export function instrumentLLM<T extends object>(
  tracer: LynxTracer,
  instance: T,
  optionsOrLabel: string | LynxLlmInstrumentationOptions = "llm.inference",
): T {
  const options =
    typeof optionsOrLabel === "string"
      ? { modelLabel: optionsOrLabel }
      : optionsOrLabel;

  const modelLabel = options.modelLabel ?? "llm.inference";
  const customRule = options.customRule;
  const firewall = options.firewall;
  const shouldReportFailures = options.reportFailures !== false;
  const shouldReportSlowResponses = options.reportSlowResponses !== false;

  const isTargetLLMMethod = (path: string[]): boolean => {
    if (customRule?.isTargetMethod) {
      return customRule.isTargetMethod(path);
    }

    const pathStr = path.join(".");
    return (
      pathStr === "chat.completions.create" || // OpenAI
      pathStr === "responses.create" || // OpenAI Responses API
      pathStr === "messages.create" || // Anthropic (Claude)
      pathStr === "models.generateContent" || // Google Gen AI 신규
      pathStr === "generateContent" || // Google Generative AI 기존
      pathStr === "generateText" || // Vercel AI SDK
      pathStr === "streamText" || // Vercel AI SDK
      pathStr === "generateObject" || // Vercel AI SDK
      pathStr === "streamObject" || // Vercel AI SDK
      pathStr === "ollama.chat" || // Ollama Chat
      pathStr === "ollama.generate" || // Ollama Generate
      pathStr === "cohere.chat" || // Cohere Chat
      pathStr === "cohere.generate" || // Cohere Generate
      pathStr === "chat" || // Ollama/Cohere direct
      pathStr === "invoke" || // LangChain
      pathStr === "predict" // LangChain
    );
  };

  /**
   * Executes one intercepted LLM call and emits a matching start/end Span.
   * Both direct functions and provider client methods use this path so their
   * usage and error semantics remain identical.
   */
  const invokeInstrumented = async (
    fn: (...args: any[]) => any,
    thisArg: unknown,
    args: any[],
    callPath: string[],
  ) => {
    const context = LynxTracer.getStore();
    const spanId = generateSpanId();
    const parentSpanId = context?.spanId;
    const childContext = createChildContext(context, spanId);
    const startTime = Date.now();
    const rawInput = customRule?.extractInput
      ? customRule.extractInput(args)
      : args[0];
    const llmMetadata = extractLlmMetadata(rawInput, callPath);
    if (firewall?.input !== false && firewall?.input) {
      evaluateFirewallBoundary(
        tracer,
        "INPUT",
        rawInput,
        firewall.input,
        `${modelLabel}.input`,
      );
    }

    if (context) {
      tracer.captureInternal(
        "LLM_CALL",
        modelLabel,
        {
          input: rawInput,
          path: callPath.join("."),
          phase: "start",
          spanId,
          parentSpanId,
          ...llmMetadata,
        },
        context,
      );
    }

    try {
      // Provider work starts inside the child context so nested async work
      // inherits the LLM Span.
      const result = childContext
        ? LynxTracer.runWithContext(childContext, () =>
            Reflect.apply(fn, thisArg, args),
          )
        : Reflect.apply(fn, thisArg, args);
      const resolvedResult = isPromiseLike(result) ? await result : result;
      const captureEnd = (output: unknown) => {
        const latency = Date.now() - startTime;
        const rawOutput = customRule?.extractOutput
          ? customRule.extractOutput(output)
          : output;
        const usage = customRule?.extractUsage
          ? customRule.extractUsage(output)
          : extractTokenUsage(output);
        const estimatedCost =
          usage && llmMetadata.model && customRule?.estimateCost
            ? customRule.estimateCost(
                String(llmMetadata.model),
                usage.promptTokens,
                usage.completionTokens,
              )
            : undefined;
        const cost =
          typeof estimatedCost === "number" &&
          Number.isFinite(estimatedCost) &&
          estimatedCost >= 0
            ? estimatedCost
            : undefined;
        if (!context) return;
        tracer.captureInternal(
          "LLM_CALL",
          modelLabel,
          {
            output: rawOutput,
            phase: "end",
            spanId,
            parentSpanId,
            latency,
            usage,
            cost,
            costSource: cost === undefined ? undefined : "CLIENT_ESTIMATED",
            llmIssueObservation: true,
            reportSlowResponse: shouldReportSlowResponses,
            slowResponseThresholdMs: options.slowResponseThresholdMs,
            modelLabel,
            path: callPath.join("."),
            ...llmMetadata,
          },
          childContext ?? context,
        );
      };
      const captureStreamError = (err: unknown) => {
        if (!context) return;
        const error = readErrorDetails(err, "LLM_ERROR");
        tracer.captureInternal(
          "ERROR",
          modelLabel,
          {
            error: error.errorMessage,
            errorName: error.errorName,
            errorCode: error.errorCode,
            errorSignature: error.errorSignature,
            llmFailure:
              shouldReportFailures && !(err instanceof LynxPolicyError),
            modelLabel,
            path: callPath.join("."),
            phase: "error",
            spanId,
            parentSpanId,
            latency: Date.now() - startTime,
            ...llmMetadata,
          },
          childContext ?? context,
        );
      };

      // A streaming provider resolves before generation finishes. Keep its
      // iterable shape and close the Span only after the consumer reaches EOF.
      if (isAsyncIterable(resolvedResult)) {
        const maxCapturedStreamChars = 64 * 1024;
        let capturedStreamText = "";
        let hasTextChunks = false;
        let firewallStreamText = "";
        return wrapAsyncIterable(
          resolvedResult,
          () => captureEnd(hasTextChunks ? capturedStreamText : resolvedResult),
          captureStreamError,
          (chunk) => {
            if (typeof chunk === "string") {
              hasTextChunks = true;
              capturedStreamText = (capturedStreamText + chunk).slice(
                -maxCapturedStreamChars,
              );
            }
            if (firewall?.output !== false && firewall?.output) {
              const selected = selectFirewallValue(chunk, firewall.output);
              if (typeof selected === "string") {
                const maxBuffer = Math.max(
                  1,
                  firewall.output.maxStreamBufferChars ?? 8_192,
                );
                firewallStreamText = (firewallStreamText + selected).slice(
                  -maxBuffer,
                );
                evaluateFirewallBoundary(
                  tracer,
                  "OUTPUT",
                  firewallStreamText,
                  firewall.output,
                  `${modelLabel}.output`,
                  false,
                );
              } else {
                evaluateFirewallBoundary(
                  tracer,
                  "OUTPUT",
                  selected,
                  firewall.output,
                  `${modelLabel}.output`,
                  false,
                );
              }
            }
          },
        );
      }
      if (firewall?.output !== false && firewall?.output) {
        evaluateFirewallBoundary(
          tracer,
          "OUTPUT",
          rawOutputForFirewall(resolvedResult, customRule?.extractOutput),
          firewall.output,
          `${modelLabel}.output`,
        );
      }
      captureEnd(resolvedResult);
      return resolvedResult;
    } catch (err: unknown) {
      const error = readErrorDetails(err, "LLM_ERROR");
      const latency = Date.now() - startTime;
      if (context) {
        tracer.captureInternal(
          "ERROR",
          modelLabel,
          {
            error: error.errorMessage,
            errorName: error.errorName,
            errorCode: error.errorCode,
            errorSignature: error.errorSignature,
            llmFailure:
              shouldReportFailures && !(err instanceof LynxPolicyError),
            modelLabel,
            path: callPath.join("."),
            phase: "error",
            spanId,
            parentSpanId,
            latency,
            ...llmMetadata,
          },
          childContext ?? context,
        );
      }
      throw err;
    }
  };

  const createRecursiveProxy = (target: any, path: string[] = []): any => {
    if (
      target == null ||
      (typeof target !== "object" && typeof target !== "function")
    ) {
      return target;
    }

    return new Proxy(target, {
      // A direct function passed to instrumentLLM is itself the target call.
      apply(fn, thisArg, args) {
        if (path.length === 0) {
          return invokeInstrumented(fn, thisArg, args, ["call"]);
        }
        return Reflect.apply(fn, thisArg, args);
      },
      get(obj, prop) {
        if (typeof prop === "symbol") {
          return Reflect.get(obj, prop);
        }

        const val = obj[prop];
        const newPath = [...path, prop];

        if (typeof val === "function" && isTargetLLMMethod(newPath)) {
          return function (this: unknown, ...args: any[]) {
            return invokeInstrumented(val, obj, args, newPath);
          };
        }

        if (val && (typeof val === "object" || typeof val === "function")) {
          return createRecursiveProxy(val, newPath);
        }

        return val;
      },
    });
  };

  return createRecursiveProxy(instance);
}

/** Selects the provider-specific value inspected by one firewall boundary. */
function selectFirewallValue(
  value: unknown,
  options: LynxLlmFirewallBoundaryOptions,
): unknown {
  if (options.select) return options.select(value);
  return extractTextLike(value) ?? value;
}

/** Extracts common provider text shapes without binding to one vendor SDK. */
function extractTextLike(
  value: unknown,
  depth = 0,
  visited = new WeakSet<object>(),
): string | undefined {
  if (typeof value === "string") return value;
  if (depth > 5 || value === null || typeof value !== "object") {
    return undefined;
  }
  if (visited.has(value)) return undefined;
  visited.add(value);
  try {
    if (Array.isArray(value)) {
      const parts = value
        .map((item) => extractTextLike(item, depth + 1, visited))
        .filter((item): item is string => Boolean(item));
      return parts.length > 0 ? parts.join("\n") : undefined;
    }
    const record = value as Record<string, unknown>;
    for (const key of [
      "output_text",
      "text",
      "content",
      "input",
      "prompt",
      "messages",
      "contents",
      "choices",
      "delta",
      "message",
    ]) {
      if (!(key in record)) continue;
      const text = extractTextLike(record[key], depth + 1, visited);
      if (text !== undefined) return text;
    }
    return undefined;
  } finally {
    visited.delete(value);
  }
}

/** Uses the custom telemetry extractor before an optional boundary selector. */
function rawOutputForFirewall(
  result: unknown,
  extractOutput?: (result: any) => any,
): unknown {
  return extractOutput ? extractOutput(result) : result;
}

/** Evaluates one LLM boundary while removing wrapper-only options. */
function evaluateFirewallBoundary(
  tracer: LynxTracer,
  phase: "INPUT" | "OUTPUT",
  value: unknown,
  options: LynxLlmFirewallBoundaryOptions,
  defaultLabel: string,
  applySelector = true,
): void {
  const {
    select,
    maxStreamBufferChars: _maxStreamBufferChars,
    ...firewallOptions
  } = options;
  const selected = applySelector ? selectFirewallValue(value, options) : value;
  const resolvedOptions = {
    ...firewallOptions,
    label: firewallOptions.label ?? defaultLabel,
  };
  if (phase === "INPUT") {
    tracer.firewallInput(selected, resolvedOptions);
  } else {
    tracer.firewallOutput(selected, resolvedOptions);
  }
}

/**
 * Wraps a tool function with Lynx telemetry instrumentation.
 *
 * This low-level helper is used by `LynxTracer.instrumentTool()`. The wrapped
 * function emits `TOOL_CALL` before execution and `TOOL_RESULT` after success.
 * If the tool throws, an `ERROR` event is captured and the original error is
 * rethrown.
 *
 * Most application code should call `lynx.instrumentTool(name, fn, metadata)`
 * instead of importing this helper directly.
 *
 * @typeParam T Tool function type.
 * @param tracer Tracer that receives captured telemetry.
 * @param toolName Stable tool name shown in traces and analytics.
 * @param fn Tool function to execute.
 * @param metadata Optional tool metadata such as risk level or side effects.
 * @returns A wrapped function with the same call signature as `fn`.
 */
export function instrumentTool<T extends (...args: any[]) => any>(
  tracer: LynxTracer,
  toolName: string,
  fn: T,
  metadata: LynxToolMetadata = {},
): T {
  return function (this: unknown, ...args: Parameters<T>) {
    const context = LynxTracer.getStore();
    const spanId = generateSpanId();
    const parentSpanId = context?.spanId;
    const childContext = createChildContext(context, spanId);
    const startTime = Date.now();
    const argsHash = createStableHash(args[0]);
    const timeoutMs = resolveToolTimeoutMs(metadata.timeoutMs);
    const shouldReportFailures = metadata.reportFailures !== false;

    if (context) {
      tracer.captureInternal(
        "TOOL_CALL",
        toolName,
        {
          toolName,
          toolVersion: metadata.toolVersion,
          sideEffect: metadata.sideEffect,
          riskLevel: metadata.riskLevel,
          externalTarget: metadata.externalTarget,
          idempotencyKey: metadata.idempotencyKey,
          args: args[0],
          argsHash,
          input: args[0],
          phase: "start",
          spanId,
          parentSpanId,
        },
        context,
      );
    }

    const captureSuccess = (resolvedResult: Awaited<ReturnType<T>>) => {
      const latency = Date.now() - startTime;

      if (context) {
        tracer.captureInternal(
          "TOOL_RESULT",
          toolName,
          {
            toolName,
            toolVersion: metadata.toolVersion,
            result: resolvedResult,
            resultSummary: summarizeResult(resolvedResult),
            output: resolvedResult,
            phase: "end",
            spanId,
            parentSpanId,
            latency,
            toolFailureRecovery: shouldReportFailures,
          },
          childContext ?? context,
        );
      }
      return resolvedResult;
    };

    const captureError = (err: unknown): never => {
      const error = readErrorDetails(err, "TOOL_ERROR");
      const latency = Date.now() - startTime;
      const isTimeout = err instanceof LynxToolTimeoutError;
      if (context) {
        tracer.captureInternal(
          "ERROR",
          toolName,
          {
            error: error.errorMessage,
            errorName: error.errorName,
            errorCode: error.errorCode,
            errorSignature: error.errorSignature,
            toolName,
            toolVersion: metadata.toolVersion,
            argsHash,
            sideEffect: metadata.sideEffect,
            riskLevel: metadata.riskLevel,
            externalTarget: metadata.externalTarget,
            retryCount: metadata.retryCount,
            toolFailure: shouldReportFailures,
            toolTimedOut: isTimeout,
            timeoutMs: isTimeout ? timeoutMs : undefined,
            phase: "error",
            spanId,
            parentSpanId,
            latency,
          },
          childContext ?? context,
        );
      }
      throw err;
    };

    try {
      // Reflect.apply preserves methods that depend on their caller-provided
      // `this`, while AsyncLocalStorage.run preserves the child Span for work
      // started inside both synchronous and asynchronous tools.
      const result = childContext
        ? LynxTracer.runWithContext(childContext, () =>
            Reflect.apply(fn, this, args),
          )
        : Reflect.apply(fn, this, args);

      if (isPromiseLike<Awaited<ReturnType<T>>>(result)) {
        const work = Promise.resolve(result);
        const boundedWork =
          timeoutMs === undefined
            ? work
            : waitForToolWithin(work, toolName, timeoutMs);
        return boundedWork.then(captureSuccess, captureError);
      }
      return captureSuccess(result as Awaited<ReturnType<T>>);
    } catch (err: unknown) {
      return captureError(err);
    }
  } as T;
}
