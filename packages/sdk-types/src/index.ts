/**
 * AsyncLocalStorage 내부에서 관리되는 컨텍스트 구조입니다.
 */
export interface LynxContext {
  runId: string;
  agentName: string;
  spanId?: string;
  parentSpanId?: string;
  sampled?: boolean;
  workspaceId?: string;
  agentId?: string;
  sessionId?: string;
  eventCounts?: Record<string, number>;
}

/**
 * 에이전트 실행 추적을 위한 옵션 정보입니다.
 */
export interface LynxRunOptions {
  agentName: string;
  workspaceId?: string;
  agentId?: string;
  sessionId?: string;
  runId?: string;
}

/**
 * Lynx SDK 초기화를 위한 설정 옵션입니다.
 */
export interface LynxConfig {
  clientId: string;
  lynxCloudUrl: string;
  workspaceId?: string;
  agentId?: string;
  apiKey?: string;
  appVersion?: string;
  deploymentId?: string;
  environment?: string;
  policyVersion?: string;

  /**
   * 텔레메트리 전송 샘플링 비율 (0.0 ~ 1.0).
   * 0.1이면 10%의 트레이스만 전송합니다. 지정되지 않으면 1.0 (100%) 전송.
   */
  sampleRate?: number;

  /**
   * 입력을 캡처하여 보낼지 여부 (기본값: true).
   */
  captureInput?: boolean;

  /**
   * 출력을 캡처하여 보낼지 여부 (기본값: true).
   */
  captureOutput?: boolean;

  /**
   * 단일 이벤트 내의 payload 전체 JSON 문자열 최대 길이 (기본값: 5000).
   */
  maxPayloadLength?: number;

  /**
   * 텔레메트리 캡처 및 압축 모드
   * - 'full': 원본 페이로드 전체를 그대로 전송하고 저장합니다.
   * - 'metadata-only': 원문은 버리고 해시, 비용, 지연시간, 토큰 사용량, 매칭된 툴 등 메타데이터만 캡처합니다.
   * - 'smart': (기본값) 헤드+테일 압축, 중요 패턴 추출 등을 활용한 운영 의미 기반 압축 텔레메트리를 전송합니다.
   */
  captureMode?: "full" | "metadata-only" | "smart";

  /**
   * 배치 전송 버퍼 최대 크기 (기본값: 50개)
   */
  batchSize?: number;

  /**
   * 배치 전송 플러시 주기 (기본값: 3000ms)
   */
  flushIntervalMs?: number;

  /**
   * Whether `run()` should trigger a telemetry flush after the wrapped block
   * finishes. Defaults to `true` for backwards compatibility.
   */
  flushOnRunEnd?: boolean;

  /**
   * Maximum time to wait for a single telemetry HTTP request, in milliseconds.
   * Defaults to 5000ms.
   */
  requestTimeoutMs?: number;

  /**
   * When true, telemetry delivery is scheduled in the background and SDK calls
   * do not wait for network delivery except during `shutdown()`. Defaults to
   * `false`.
   */
  backgroundOnly?: boolean;

  /**
   * Enables a circuit breaker for telemetry delivery. When the breaker is open,
   * the SDK skips network sends and keeps events in the retry queue. Defaults to
   * `true`.
   */
  circuitBreakerEnabled?: boolean;

  /**
   * Number of consecutive failed telemetry sends required to open the circuit
   * breaker. Defaults to 3.
   */
  circuitBreakerFailureThreshold?: number;

  /**
   * How long an open circuit breaker should wait before allowing another send
   * attempt, in milliseconds. Defaults to 30000ms.
   */
  circuitBreakerCooldownMs?: number;
}

/**
 * 토큰 사용량 정보입니다.
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type LynxSessionStatus = "COMPLETED" | "FAILED" | "CANCELLED";
export type LynxBusinessStatus = "SUCCEEDED" | "FAILED" | "PARTIAL" | "UNKNOWN";
export type LynxRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface LynxOutcomeOptions {
  status: LynxSessionStatus;
  businessStatus?: LynxBusinessStatus;
  reason?: string;
  userImpact?: LynxRiskLevel;
  metadata?: Record<string, any>;
}

export interface LynxToolMetadata {
  toolVersion?: string;
  sideEffect?: boolean;
  riskLevel?: LynxRiskLevel;
  externalTarget?: string;
  idempotencyKey?: string;
  [key: string]: any;
}

export interface LynxPolicyDecision {
  allow: boolean;
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
    args: TArgs;
    metadata?: LynxToolMetadata;
  }) => LynxPolicyDecision | Promise<LynxPolicyDecision>;
}

/**
 * 특정 LLM 클라이언트를 가로채고 계측하기 위한 커스텀 규칙 인터페이스입니다.
 */
export interface LlmInstrumentationRule {
  /**
   * 해당 메소드 접근 경로(예: ["chat", "completions", "create"])가 가로채기 대상인지 여부를 판단합니다.
   */
  isTargetMethod: (path: string[]) => boolean;
  /**
   * 가로챈 메소드의 입력 인자들로부터 프롬프트 또는 입력 구조 데이터를 추출합니다.
   */
  extractInput?: (args: any[]) => any;
  /**
   * 가로챈 메소드의 실행 결과물로부터 응답 텍스트 또는 결과 데이터를 추출합니다.
   */
  extractOutput?: (result: any) => any;
  /**
   * 가로챈 메소드의 실행 결과물로부터 사용된 토큰량을 추출합니다.
   */
  extractUsage?: (result: any) => TokenUsage | undefined;
  /**
   * 가로챈 모델 및 토큰 사용량에 대한 비용을 추정합니다.
   */
  estimateCost?: (
    model: string,
    promptTokens: number,
    completionTokens: number,
  ) => number;
}

/**
 * Lynx SDK가 추적할 수 있는 이벤트 타입입니다.
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
 * 추적된 이벤트의 세부 정보를 포함하는 페이로드 DTO 스키마입니다.
 */
export interface LynxEventPayloadDto {
  input?: any;
  output?: any;
  error?: string;
  arguments?: any;

  // Span Hierarchical Tracking
  spanId?: string;
  parentSpanId?: string;

  // Performance and Cost Analytics
  latency?: number; // millisecond duration of the execution
  usage?: TokenUsage; // token usage for LLM calls
  cost?: number; // estimated cost in USD

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

  // Prompt injection & pollution alert metadata
  isPolluted?: boolean;
  pollutionReason?: string;

  [key: string]: any;
}

export interface LynxEventDto {
  clientId: string;
  runId: string;
  agentName: string;
  eventType: LynxEventType;
  label: string;
  payload: LynxEventPayloadDto;
  timestamp: number;
  workspaceId?: string;
  agentId?: string;
  sessionId?: string;
  schemaVersion?: string;
}
