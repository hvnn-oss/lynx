import { HTTPException } from "hono/http-exception";

/** 최신 상태와 충돌하는 동시 수정 요청에 사용하는 HTTP 409 오류입니다. */
export class ConflictErrorException extends HTTPException {
  constructor(message = "The resource was modified by another request.") {
    super(409, { message });
  }
}
