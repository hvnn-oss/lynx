import type { ApiKeyScope } from "@repo/constants";
import type { Logger } from "pino";

/** Hono 애플리케이션의 요청 생명주기에서 공유하는 context 타입입니다. */
export type AppEnv = {
  Variables: {
    /** 요청 추적과 오류 응답에 사용하는 고유 식별자입니다. */
    requestId: string;
    /** requestId가 결합된 요청 전용 구조화 로거입니다. */
    logger: Logger;
    /** Access Token으로 인증된 사용자 식별자입니다. */
    currentUserId: string;
    /** 인증 수단으로 확인한 현재 워크스페이스 식별자입니다. */
    currentWorkspaceId: string;
    /** 현재 Workspace API 키 record의 식별자입니다. */
    currentApiKeyId: string;
    /** 현재 Workspace API 키에 부여된 전체 권한입니다. */
    currentApiKeyScopes: ApiKeyScope[];
    /** 현재 Workspace API 키에 연결된 실행 환경입니다. */
    currentApiKeyEnvironment: string;
    /** 현재 요청이 API Key rate limit에 의해 거절됐는지 나타냅니다. */
    openApiRateLimited?: boolean;
    /** 이벤트 수집 요청에서 정상 접수된 이벤트 수입니다. */
    openApiAcceptedEventCount?: number;
    /** 이벤트 수집 요청에서 거절되거나 재시도할 이벤트 수입니다. */
    openApiRejectedEventCount?: number;
  };
};

/** OpenAPI 키 문자열에서 분리한 공개 정보와 비밀값입니다. */
export interface ParsedApiKey {
  /** 키가 발급된 실행 환경입니다. */
  environment: string;
  /** 데이터베이스 조회에 사용하는 공개 키 식별자입니다. */
  id: string;
  /** 키 소유 증명에 사용하는 비밀 문자열입니다. */
  secret: string;
}
