import { HTTPException } from "hono/http-exception";

/** 인증된 사용자가 요청한 작업 권한이 없을 때 사용하는 HTTP 403 오류입니다. */
export class ForbiddenErrorException extends HTTPException {
  constructor(message = "You do not have permission to access this resource.") {
    super(403, { message });
  }
}
