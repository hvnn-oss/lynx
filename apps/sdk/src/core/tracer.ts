import { AsyncLocalStorage } from "async_hooks";
import {
  LynxConfig,
  LynxContext,
  LynxRunOptions,
  LlmInstrumentationRule,
  LynxEventDto,
} from "./types.js";
import { processPayload } from "../utils/payload.js";
import { generateTraceId, generateSpanId } from "../utils/id.js";
import { instrumentLLM, instrumentTool } from "../instrumentation/index.js";

/**
 * 에이전트 실행, LLM 호출 및 도구 사용을 모니터링하고 캡처하는 트레이서 클래스입니다.
 */
export class LynxTracer {
  private static readonly storage = new AsyncLocalStorage<LynxContext>();
  private readonly pendingPromises = new Set<Promise<any>>();
  private readonly eventQueue: LynxEventDto[] = [];
  private readonly retryQueue: LynxEventDto[] = [];
  private lastFailureTime = 0;
  private backoffDelayMs = 1000;
  private flushTimer: NodeJS.Timeout | null = null;

  /**
   * 트레이서 인스턴스를 초기화합니다.
   */
  constructor(private readonly config: LynxConfig) {
    const interval = this.config.flushIntervalMs ?? 3000;
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, interval);

    // Node.js 프로세스가 타이머 때문에 강제로 켜져 있지 않도록 설정
    if (this.flushTimer && typeof this.flushTimer.unref === "function") {
      this.flushTimer.unref();
    }

    // 프로세스 종료 시 잔여 큐 플러시
    if (typeof process !== "undefined") {
      process.on("beforeExit", () => {
        void this.flush();
      });
      process.on("exit", () => {
        void this.flush();
      });
    }
  }

  /**
   * 활성화된 비동기 컨텍스트의 저장된 정보를 조회합니다.
   */
  static getStore(): LynxContext | undefined {
    return LynxTracer.storage.getStore();
  }

  /**
   * 버퍼 큐에 쌓여 있는 이벤트들을 수집 서버로 한 번에 전송합니다.
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0 && this.retryQueue.length === 0) {
      return;
    }

    // 백오프 대기 시간 검사
    if (this.lastFailureTime > 0 && Date.now() - this.lastFailureTime < this.backoffDelayMs) {
      return;
    }

    const eventsToFlush = [...this.retryQueue, ...this.eventQueue];
    this.retryQueue.length = 0;
    this.eventQueue.length = 0;

    if (eventsToFlush.length === 0) {
      return;
    }

    const url = `${this.config.lynxCloudUrl}/api/v1/events/batch`;
    console.log(`[LynxTracer] flushing ${eventsToFlush.length} events to: ${url}`);
    
    const promise = fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventsToFlush),
      signal: AbortSignal.timeout(5000),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          console.error(`[LynxTracer] telemetry batch flush failed with status ${res.status}: ${text}`);
          this.handleFailedEvents(eventsToFlush);
        } else {
          // 전송 성공 시 백오프 리셋
          this.lastFailureTime = 0;
          this.backoffDelayMs = 1000;
        }
      })
      .catch((err) => {
        console.error("LynxTracer telemetry batch flush failed:", err);
        this.handleFailedEvents(eventsToFlush);
      })
      .finally(() => {
        this.pendingPromises.delete(promise);
      });

    this.pendingPromises.add(promise);
    await promise;
  }

  private handleFailedEvents(events: LynxEventDto[]): void {
    this.lastFailureTime = Date.now();
    
    const maxBufferSize = 1000;
    const totalCount = this.retryQueue.length + events.length;
    if (totalCount > maxBufferSize) {
      const discardCount = totalCount - maxBufferSize;
      this.retryQueue.splice(0, discardCount); // OOM 방지를 위해 오래된 실패 이벤트 삭제
    }
    this.retryQueue.push(...events);
    
    // 최대 1분 한도로 지수 백오프
    this.backoffDelayMs = Math.min(this.backoffDelayMs * 2, 60000);
    console.warn(
      `[LynxTracer] Offline retry buffer saved ${events.length} events. Total size: ${this.retryQueue.length}. Backing off for ${this.backoffDelayMs}ms.`
    );
  }

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
    const runId = options.runId ?? (parentContext ? parentContext.runId : generateTraceId());
    const parentSpanId = parentContext ? parentContext.spanId : undefined;
    const spanId = generateSpanId();

    const workspaceId = options.workspaceId ?? parentContext?.workspaceId ?? this.config.workspaceId ?? process.env.LYNX_WORKSPACE_ID ?? "Default Workspace";
    const agentId = options.agentId ?? parentContext?.agentId ?? this.config.agentId ?? process.env.LYNX_AGENT_ID ?? agentName;
    const sessionId = options.sessionId ?? parentContext?.sessionId ?? process.env.LYNX_SESSION_ID ?? `session_${runId}`;

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
  captureInternal(
    eventType: LynxEventDto["eventType"],
    label: string,
    payload: any,
    context: LynxContext,
  ): void {
    // Tail-based/Adaptive sampling fallback:
    // 에러 관련 이벤트인 경우 샘플링 여부(sampled === false)와 관계없이 강제 수집함.
    const isError = eventType === "ERROR" || (payload && (payload.error || "error" in payload));
    if (context.sampled === false && !isError) {
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
      schemaVersion: "1", // 스키마 버저닝 추가
    };

    this.eventQueue.push(eventDto);

    const maxBatchSize = this.config.batchSize ?? 50;
    if (this.eventQueue.length >= maxBatchSize) {
      void this.flush();
    }
  }

  /**
   * Proxy를 사용해 다양한 LLM 클라이언트 인스턴스(OpenAI, Anthropic, Google Gen AI 등)를 동적으로 감시하고 추적을 기록합니다.
   */
  instrumentLLM<T extends object>(
    instance: T,
    optionsOrLabel: string | {
      modelLabel?: string;
      customRule?: Partial<LlmInstrumentationRule>;
    } = "llm.inference"
  ): T {
    return instrumentLLM(this, instance, optionsOrLabel);
  }

  /**
   * 도구 함수를 래핑하여 실행 매개변수와 반환 결과 및 오류를 추적합니다.
   */
  instrumentTool<T extends (...args: any[]) => any>(
    toolName: string,
    fn: T,
  ): T {
    return instrumentTool(this, toolName, fn);
  }
}
