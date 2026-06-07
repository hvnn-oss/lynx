/**
 * Lynx SDK가 추적할 수 있는 이벤트 타입입니다.
 */
export type LynxEventType = "LLM_REASONING" | "CALL_TOOLS" | "ERROR" | "CONTEXT_ALERT";

/**
 * 토큰 사용량 정보입니다.
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

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
}

