import { HTTPException } from "hono/http-exception";

/** 인증 정보가 없거나 유효하지 않을 때 사용하는 HTTP 401 오류입니다. */
export class UnauthorizedErrorException extends HTTPException {
  constructor(message = "Access denied. Please check your credentials.") {
    super(401, { message });
  }
}
