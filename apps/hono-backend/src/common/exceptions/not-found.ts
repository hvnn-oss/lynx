import { HTTPException } from "hono/http-exception";

/** 요청한 리소스를 찾을 수 없을 때 사용하는 HTTP 404 오류입니다. */
export class NotFoundErrorException extends HTTPException {
  constructor(message = "Could not find requested resources in our server.") {
    super(404, { message });
  }
}
