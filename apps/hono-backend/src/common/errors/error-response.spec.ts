import { HTTPException } from "hono/http-exception";

import { createPublicErrorResponse } from "./error-response.js";

describe("createPublicErrorResponse", () => {
  it("HTTPException의 상태와 내부 메시지를 외부 응답에 보존한다", () => {
    const response = createPublicErrorResponse(
      new HTTPException(401, { message: "INVALID_CREDENTIALS" }),
      "request-1",
    );

    expect(response).toEqual({
      code: "INVALID_CREDENTIALS",
      message: "INVALID_CREDENTIALS",
      requestId: "request-1",
      status: 401,
    });
  });

  it("일반 Error의 내부 메시지는 외부 응답에 노출하지 않는다", () => {
    const response = createPublicErrorResponse(
      new Error("database unavailable"),
      "request-2",
    );

    expect(response.status).toBe(500);
    expect(response.code).toBe("INTERNAL_SERVER_ERROR");
    expect(response.message).toBe("An unexpected error occurred.");
  });

  it("알 수 없는 오류에는 안전한 기본 응답을 사용한다", () => {
    const response = createPublicErrorResponse("failure", "request-3");

    expect(response.status).toBe(500);
    expect(response.code).toBe("INTERNAL_SERVER_ERROR");
  });
});
