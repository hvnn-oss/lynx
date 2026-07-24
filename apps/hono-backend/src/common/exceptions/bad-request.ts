import { HTTPException } from "hono/http-exception";

/** 요청 형식이나 입력값이 올바르지 않을 때 사용하는 HTTP 400 오류입니다. */
export class BadRequestErrorException extends HTTPException {
  constructor(
    message = "The request could not be understood or was malformed.",
  ) {
    super(400, { message });
  }
}
