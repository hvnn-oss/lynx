import { AsyncLocalStorage } from "async_hooks";
import { randomUUID, createHash } from "crypto";
import { LynxEventDto, TokenUsage } from "@repo/dto";
import { LynxConfig, LynxContext, LynxRunOptions, LlmInstrumentationRule } from "./types.js";

/**
 * 주어진 데이터에 대한 SHA-256 해시값의 앞 16자리를 반환합니다.
 */
function getHash(data: any): string {
  const str = typeof data === "string" ? data : JSON.stringify(data);
  return createHash("sha256").update(str || "").digest("hex").slice(0, 16);
}

const RISK_PATTERNS = [
  /ignore/i,
  /transfer/i,
  /payment/i,
  /delete/i,
  /system prompt/i,
  /bypass/i,
  /shutdown/i,
  /sudo/i,
  /admin/i,
  /leak/i
];

function extractRiskFlags(text: string): string[] {
  const flags: string[] = [];
  for (const pattern of RISK_PATTERNS) {
    if (pattern.test(text)) {
      const cleanPattern = pattern.source.replace(/\\/g, "");
      flags.push(cleanPattern);
    }
  }
  return flags;
}

function headTailTruncate(text: string, maxLen: number = 1000): string {
  if (text.length <= maxLen) return text;
  const reserve = 80; // space for indicator
  const half = Math.floor((maxLen - reserve) / 2);
  if (half <= 0) return "... [TRUNCATED] ...";
  const head = text.substring(0, half);
  const tail = text.substring(text.length - half);
  const truncatedCount = text.length - (head.length + tail.length);
  return `${head}... [TRUNCATED ${truncatedCount} CHARS] ...${tail}`;
}

/**
 * 설정 정책 및 캡처 모드(captureMode: full, metadata-only, smart)에 따라 페이로드를 압축 및 가공합니다.
 */
function processPayload(payload: any, config: LynxConfig): any {
  if (!payload || typeof payload !== "object") return payload;

  // 순환 참조 및 에러 방지를 위한 깊은 복사
  let copy: any;
  try {
    copy = JSON.parse(JSON.stringify(payload));
  } catch {
    return { error: "[Unserializable Payload]" };
  }

  // 1. Capture Input / Output 기본 정책 제어 (Legacy/Override)
  if (config.captureInput === false && "input" in copy) {
    delete copy.input;
  }
  if (config.captureOutput === false && "output" in copy) {
    delete copy.output;
  }

  const mode = config.captureMode || "smart";

  // 2. 중요 리스크 패턴 추출 (모든 모드에서 메타데이터로 남겨 디버깅 활용)
  let textToAnalyze = "";
  if (copy.input) {
    textToAnalyze += typeof copy.input === "string" ? copy.input : JSON.stringify(copy.input);
  }
  if (copy.output) {
    textToAnalyze += typeof copy.output === "string" ? copy.output : JSON.stringify(copy.output);
  }

  const riskFlags = textToAnalyze ? extractRiskFlags(textToAnalyze) : [];
  if (riskFlags.length > 0) {
    copy.riskFlags = riskFlags;
  }

  // 3. captureMode 별 페이로드 가공
  if (mode === "metadata-only") {
    // 3-1. 메타데이터만 남기는 모드 (원문 저장 배제)
    if ("input" in copy) {
      const inputStr = typeof copy.input === "string" ? copy.input : JSON.stringify(copy.input);
      copy.promptHash = getHash(copy.input);
      copy.promptLength = inputStr.length;
      delete copy.input;
    }
    if ("output" in copy) {
      const outputStr = typeof copy.output === "string" ? copy.output : JSON.stringify(copy.output);
      copy.responseHash = getHash(copy.output);
      copy.responseLength = outputStr.length;
      delete copy.output;
    }
    return copy;
  }

  if (mode === "smart") {
    // 3-2. 스마트 페이로드 감축 모드 (Head + Tail Truncation 및 중요 정보 보존)
    const maxLen = config.maxPayloadLength ?? 1000;

    const walkAndSmartTruncate = (obj: any): any => {
      if (!obj || typeof obj !== "object") return obj;

      if (Array.isArray(obj)) {
        return obj.map((item) => walkAndSmartTruncate(item));
      }

      const res: any = {};
      for (const key of Object.keys(obj)) {
        const priorityKeys = ["spanid", "parentspanid", "latency", "usage", "cost", "error", "path", "riskflags"];
        if (priorityKeys.includes(key.toLowerCase())) {
          res[key] = obj[key];
        } else if (typeof obj[key] === "object") {
          res[key] = walkAndSmartTruncate(obj[key]);
        } else if (typeof obj[key] === "string") {
          res[key] = headTailTruncate(obj[key], maxLen);
        } else {
          res[key] = obj[key];
        }
      }
      return res;
    };

    return walkAndSmartTruncate(copy);
  }

  // 3-3. Full Payload 모드 (전체 페이로드 원본 유지)
  return copy;
}

/**
 * AI 모델에 따른 토큰당 비용(USD, 100만 토큰 기준)을 계산합니다.
 */
function estimateLlmCost(model: string, promptTokens: number, completionTokens: number): number {
  const modelLower = model.toLowerCase();
  let inputRate = 1.0;  // 1M 토큰당 기본 입력 비용
  let outputRate = 2.0; // 1M 토큰당 기본 출력 비용

  if (modelLower.includes("gpt-4o")) {
    inputRate = 2.50;
    outputRate = 10.00;
  } else if (modelLower.includes("gpt-4")) {
    inputRate = 30.00;
    outputRate = 60.00;
  } else if (modelLower.includes("gpt-3.5")) {
    inputRate = 0.50;
    outputRate = 1.50;
  } else if (modelLower.includes("claude-3-5-sonnet") || modelLower.includes("sonnet")) {
    inputRate = 3.00;
    outputRate = 15.00;
  } else if (modelLower.includes("claude-3-opus") || modelLower.includes("opus")) {
    inputRate = 15.00;
    outputRate = 75.00;
  } else if (modelLower.includes("gemini")) {
    inputRate = 0.075;
    outputRate = 0.30;
  }

  return (promptTokens * inputRate + completionTokens * outputRate) / 1_000_000;
}

/**
 * 다양한 LLM 응답 포맷에서 토큰 사용량을 표준화하여 추출합니다.
 */
function extractTokenUsage(result: any): TokenUsage | undefined {
  if (!result || typeof result !== "object") return undefined;

  // 1. OpenAI, Anthropic 일반 규격
  const usage = result.usage;
  if (usage) {
    const promptTokens = usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokens ?? 0;
    const completionTokens = usage.completion_tokens ?? usage.output_tokens ?? usage.completionTokens ?? 0;
    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens
    };
  }

  // 2. Google Gemini Generative AI 규격
  const usageMetadata = result.usageMetadata;
  if (usageMetadata) {
    const promptTokens = usageMetadata.promptTokenCount ?? 0;
    const completionTokens = usageMetadata.candidatesTokenCount ?? usageMetadata.completionTokenCount ?? 0;
    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens
    };
  }

  return undefined;
}

/**
 * 에이전트 실행, LLM 호출 및 도구 사용을 모니터링하고 캡처하는 트레이서 클래스입니다.
 */
export class LynxTracer {
  private static readonly storage = new AsyncLocalStorage<LynxContext>();
  private readonly pendingPromises = new Set<Promise<any>>();

  /**
   * 트레이서 인스턴스를 초기화합니다.
   */
  constructor(private readonly config: LynxConfig) {}

  /**
   * 실행 블록을 추적 대상 실행 컨텍스트로 감쌉니다.
   * 중첩 호출 시 자동으로 parentSpanId 관계를 맺습니다.
   */
  async run<T>(
    optionsOrAgentName: string | LynxRunOptions,
    executionBlock: () => Promise<T> | T,
  ): Promise<T> {
    const options = typeof optionsOrAgentName === "string"
      ? { agentName: optionsOrAgentName }
      : optionsOrAgentName;

    const agentName = options.agentName;
    const parentContext = LynxTracer.storage.getStore();
    const runId = options.runId ?? (parentContext ? parentContext.runId : randomUUID());
    const parentSpanId = parentContext ? parentContext.spanId : undefined;
    const spanId = randomUUID();

    const workspaceId = options.workspaceId ?? parentContext?.workspaceId ?? this.config.workspaceId ?? process.env.LYNX_WORKSPACE_ID ?? "Default Workspace";
    const agentId = options.agentId ?? parentContext?.agentId ?? this.config.agentId ?? process.env.LYNX_AGENT_ID ?? agentName;
    const sessionId = options.sessionId ?? parentContext?.sessionId ?? process.env.LYNX_SESSION_ID ?? `session_${runId}`;

    // 부모 컨텍스트가 존재하면 부모의 샘플링 결정을 따릅니다.
    // 그렇지 않은 경우 설정값(sampleRate)을 기준으로 샘플링 여부를 결정합니다.
    const sampled = parentContext
      ? (parentContext.sampled ?? true)
      : (this.config.sampleRate !== undefined ? Math.random() < this.config.sampleRate : true);

    const currentContext: LynxContext = {
      runId,
      agentName,
      spanId,
      parentSpanId,
      sampled,
      workspaceId,
      agentId,
      sessionId
    };

    console.log(`[LynxTracer] run started for agent: ${agentName}, runId: ${runId}, spanId: ${spanId}, parentSpanId: ${parentSpanId}`);
    
    // 명시적인 실행 시작 텔레메트리 전송
    this.captureInternal("CONTEXT_ALERT", `run.start:${agentName}`, {
      message: `Agent execution thread started`,
      spanId,
      parentSpanId
    }, currentContext);

    const startTime = Date.now();

    return LynxTracer.storage.run(currentContext, async () => {
      try {
        const result = await executionBlock();
        const latency = Date.now() - startTime;
        
        this.captureInternal("CONTEXT_ALERT", `run.end:${agentName}`, {
          message: `Agent execution thread succeeded`,
          spanId,
          parentSpanId,
          latency
        }, currentContext);

        return result;
      } catch (err: any) {
        const latency = Date.now() - startTime;
        this.captureInternal("ERROR", `run.error:${agentName}`, {
          error: err.message,
          spanId,
          parentSpanId,
          latency
        }, currentContext);
        throw err;
      } finally {
        if (this.pendingPromises.size > 0) {
          console.log(`[LynxTracer] awaiting ${this.pendingPromises.size} pending telemetry transmissions...`);
          await Promise.all(Array.from(this.pendingPromises));
        }
        console.log(`[LynxTracer] run finished for agent: ${agentName}, runId: ${runId}`);
      }
    });
  }

  /**
   * 활성화된 컨텍스트 외부 또는 내부에서 수동으로 로그 이벤트를 기록할 수 있도록 제공합니다.
   */
  log(label: string, payload: any): void {
    const context = LynxTracer.storage.getStore();
    if (context) {
      this.captureInternal("CONTEXT_ALERT", label, payload, context);
    } else {
      console.warn("[LynxTracer] Log was called outside a running context. Event ignored.");
    }
  }

  /**
   * 추적 이벤트를 캡처하여 컨트롤 플레인으로 전송합니다.
   */
  private capture(
    eventType: LynxEventDto["eventType"],
    label: string,
    payload: any,
  ): void {
    const context = LynxTracer.storage.getStore();
    if (!context) {
      console.warn(`[LynxTracer] Warning: event ${eventType} was captured outside a LynxTracer context!`);
      return;
    }
    this.captureInternal(eventType, label, payload, context);
  }

  /**
   * 지정된 컨텍스트를 활용하여 실제 텔레메트리 데이터를 전송하는 내부 구현체입니다.
   */
  private captureInternal(
    eventType: LynxEventDto["eventType"],
    label: string,
    payload: any,
    context: LynxContext,
  ): void {
    // 샘플링에서 제외된 트레이스의 이벤트는 컨트롤 플레인으로 전송하지 않습니다.
    if (context.sampled === false) {
      return;
    }

    const processedPayload = processPayload(payload, this.config);

    const eventPayload = {
      ...processedPayload,
      spanId: processedPayload.spanId || context.spanId,
      parentSpanId: processedPayload.parentSpanId || context.parentSpanId,
    };

    const eventDto: LynxEventDto = {
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
    };

    const url = `${this.config.lynxCloudUrl}/api/v1/events/ingest`;
    console.log(`[LynxTracer] sending telemetry to: ${url}`);
    const promise = fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventDto),
      signal: AbortSignal.timeout(5000),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          console.error(`[LynxTracer] telemetry send failed with status ${res.status}: ${text}`);
        }
      })
      .catch((err) => {
        console.error("LynxTracer telemetry send failed:", err);
      })
      .finally(() => {
        this.pendingPromises.delete(promise);
      });

    this.pendingPromises.add(promise);
  }

  /**
   * Proxy를 사용해 다양한 LLM 클라이언트 인스턴스(OpenAI, Anthropic, Google Gen AI 등)를 동적으로 감시하고 추적을 기록합니다.
   * customRule을 제공하여 기본 지원되는 공급자 외에 타 벤더나 커스텀 클라이언트도 자유롭게 래핑할 수 있습니다.
   */
  instrumentLLM<T extends object>(
    instance: T,
    optionsOrLabel: string | {
      modelLabel?: string;
      customRule?: Partial<LlmInstrumentationRule>;
    } = "llm.inference"
  ): T {
    const self = this;

    const options = typeof optionsOrLabel === "string"
      ? { modelLabel: optionsOrLabel }
      : optionsOrLabel;

    const modelLabel = options.modelLabel ?? "llm.inference";
    const customRule = options.customRule;

    // 타겟 메소드 경로가 모니터링 대상인지 확인합니다.
    const isTargetLLMMethod = (path: string[]): boolean => {
      if (customRule?.isTargetMethod) {
        return customRule.isTargetMethod(path);
      }

      const pathStr = path.join(".");
      return (
        pathStr === "chat.completions.create" || // OpenAI
        pathStr === "messages.create" ||         // Anthropic (Claude)
        pathStr === "models.generateContent" ||  // Google Gen AI 신규
        pathStr === "generateContent"            // Google Generative AI 기존
      );
    };

    // 프로퍼티 접근 경로를 재귀적으로 추적하여 프록시를 동적으로 구성합니다.
    const createRecursiveProxy = (target: any, path: string[] = []): any => {
      if (target == null || (typeof target !== "object" && typeof target !== "function")) {
        return target;
      }

      return new Proxy(target, {
        get(obj, prop) {
          if (typeof prop === "symbol") {
            return Reflect.get(obj, prop);
          }

          const val = obj[prop];
          const newPath = [...path, prop];

          // 캡처 대상 함수가 호출될 때 가로채어 트레이싱 로그를 작성합니다.
          if (typeof val === "function" && isTargetLLMMethod(newPath)) {
            return async function (this: any, ...args: any[]) {
              const context = LynxTracer.storage.getStore();
              const spanId = randomUUID();
              const parentSpanId = context?.spanId;
              const startTime = Date.now();

              // 입력값 추출 커스터마이징 지원
              const rawInput = customRule?.extractInput
                ? customRule.extractInput(args)
                : args[0];

              // 호출 시작 이벤트 전송
              if (context) {
                self.captureInternal("LLM_REASONING", modelLabel, {
                  input: rawInput,
                  path: newPath.join("."),
                  spanId,
                  parentSpanId
                }, context);
              }

              try {
                // 원래 메소드의 this 바인딩 컨텍스트를 올바르게 전달하여 실행시킵니다.
                const result = await Reflect.apply(val, obj, args);
                const latency = Date.now() - startTime;
                
                // 출력값 추출 커스터마이징 지원
                const rawOutput = customRule?.extractOutput
                  ? customRule.extractOutput(result)
                  : result;

                // 토큰 사용량 정보 추출 및 비용 추정 커스터마이징 지원
                const usage = customRule?.extractUsage
                  ? customRule.extractUsage(result)
                  : extractTokenUsage(result);

                let cost: number | undefined = undefined;
                if (usage) {
                  const modelName = args[0]?.model || modelLabel;
                  cost = customRule?.estimateCost
                    ? customRule.estimateCost(modelName, usage.promptTokens, usage.completionTokens)
                    : estimateLlmCost(modelName, usage.promptTokens, usage.completionTokens);
                }

                if (context) {
                  self.captureInternal("LLM_REASONING", modelLabel, {
                    output: rawOutput,
                    spanId,
                    parentSpanId,
                    latency,
                    usage,
                    cost
                  }, context);
                }
                return result;
              } catch (err: any) {
                const latency = Date.now() - startTime;
                if (context) {
                  self.captureInternal("ERROR", modelLabel, {
                    error: err.message,
                    spanId,
                    parentSpanId,
                    latency
                  }, context);
                }
                throw err;
              }
            };
          }

          // 중첩된 객체 구조를 계속 탐색할 수 있도록 재귀 프록시를 반환합니다.
          if (val && (typeof val === "object" || typeof val === "function")) {
            return createRecursiveProxy(val, newPath);
          }

          return val;
        },
      });
    };

    return createRecursiveProxy(instance);
  }


  /**
   * 도구 함수를 래핑하여 실행 매개변수와 반환 결과 및 오류를 추적합니다.
   */
  instrumentTool<T extends (...args: any[]) => any>(
    toolName: string,
    fn: T,
  ): T {
    return (async (...args: any[]) => {
      const context = LynxTracer.storage.getStore();
      const spanId = randomUUID();
      const parentSpanId = context?.spanId;
      const startTime = Date.now();

      if (context) {
        this.captureInternal("CALL_TOOLS", toolName, {
          input: args[0],
          spanId,
          parentSpanId
        }, context);
      }

      try {
        const result = await fn(...args);
        const latency = Date.now() - startTime;
        
        if (context) {
          this.captureInternal("CALL_TOOLS", toolName, {
            output: result,
            spanId,
            parentSpanId,
            latency
          }, context);
        }
        return result;
      } catch (err: any) {
        const latency = Date.now() - startTime;
        if (context) {
          this.captureInternal("ERROR", toolName, {
            error: err.message,
            spanId,
            parentSpanId,
            latency
          }, context);
        }
        throw err;
      }
    }) as unknown as T;
  }
}

