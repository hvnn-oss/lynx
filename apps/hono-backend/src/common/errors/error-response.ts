import { HTTPException } from "hono/http-exception";

/** 클라이언트에 공개할 수 있는 공통 오류 응답입니다. */
export type PublicErrorResponse = {
  code: string;
  message: string;
  requestId: string;
  status: number;
};

/**
 * 애플리케이션 오류를 외부 응답에 사용할 형태로 변환합니다.
 * @param error 처리할 오류입니다.
 * @param requestId 요청 추적 식별자입니다.
 * @returns HTTP 상태와 공개할 오류 정보입니다.
 */
export function createPublicErrorResponse(
  error: unknown,
  requestId: string,
): PublicErrorResponse {
  if (error instanceof HTTPException) {
    return {
      code: error.message || "REQUEST_FAILED",
      message: error.message || "The request failed.",
      requestId,
      status: error.status,
    };
  }

  if (error instanceof Error) {
    return {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
      requestId,
      status: 500,
    };
  }

  return {
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred.",
    requestId,
    status: 500,
  };
}
