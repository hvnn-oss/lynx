import { createMiddleware } from "hono/factory";

import type { AppEnv } from "../types/app-env.js";
import { logger } from "../logger/logger.js";

/** 로그에 기록할 요청 처리 시간을 소수점 둘째 자리까지 정리합니다. */
function roundDuration(durationMs: number): number {
  return Math.round(durationMs * 100) / 100;
}

/** 요청별 자식 로거를 만들고 처리 결과와 소요 시간을 기록합니다. */
export const requestLoggerMiddleware = createMiddleware<AppEnv>(
  async (c, next) => {
    const startedAt = performance.now();

    // 자식 로거의 모든 출력에 요청 식별자, 메서드, 경로를 자동으로 포함합니다.
    const requestLogger = logger.child({
      requestId: c.get("requestId"),
      method: c.req.method,
      path: c.req.path,
    });

    c.set("logger", requestLogger);

    requestLogger.debug(
      { event: "http.request.started", userAgent: c.req.header("User-Agent") },
      "request-started",
    );

    try {
      await next();
    } catch (error: unknown) {
      const durationMs = roundDuration(performance.now() - startedAt);

      requestLogger.error(
        {
          event: "http.request.failed",
          err: error,
          durationMs,
        },
        "request-failed",
      );

      // 공통 onError가 응답을 만들 수 있도록 다시 에러를 던집니다.
      throw error;
    }

    const durationMs = roundDuration(performance.now() - startedAt);

    const logData = {
      event: "http.request.completed",
      statusCode: c.res.status,
      durationMs,
    };

    if (c.res.status >= 500) {
      requestLogger.error(logData, "request completed with server error");
      return;
    }

    if (c.res.status >= 400) {
      requestLogger.warn(logData, "request completed with client error");
      return;
    }

    requestLogger.info(logData, "request completed");
  },
);
