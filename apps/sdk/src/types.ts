import { TokenUsage } from "@repo/dto";

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
  estimateCost?: (model: string, promptTokens: number, completionTokens: number) => number;
}


