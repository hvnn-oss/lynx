import { HTTPException } from "hono/http-exception";
import { createMiddleware } from "hono/factory";
import {
  OpenApiUsageService,
  openApiUsageService,
} from "../services/openapi-usage.service.js";
import type { AppEnv } from "../types/app-env.js";

const UUID_PATH_SEGMENT =
  /\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?=\/|$)/gi;

/**
 * 인증된 OpenAPI 요청의 결과를 비동기로 집계합니다.
 *
 * 집계 저장 실패는 SDK 요청의 성공 여부에 영향을 주지 않습니다.
 */
export function createOpenApiUsageMiddleware(
  usageService: Pick<OpenApiUsageService, "record"> = openApiUsageService,
) {
  return createMiddleware<AppEnv>(async (context, next) => {
    const startedAt = performance.now();
    let thrownError: unknown;

    try {
      await next();
    } catch (error) {
      thrownError = error;
      throw error;
    } finally {
      const statusCode = context.get("openApiRateLimited")
        ? 429
        : thrownError instanceof HTTPException
          ? thrownError.status
          : thrownError
            ? 500
            : context.res.status;
      const requestBytes = readContentLength(
        context.req.header("content-length"),
      );
      const responseBytes = readContentLength(
        context.res.headers.get("content-length") ?? undefined,
      );
      const endpoint = `${context.req.method} ${context.req.path.replace(
        UUID_PATH_SEGMENT,
        "/:id",
      )}`;

      void usageService
        .record({
          apiKeyId: context.get("currentApiKeyId"),
          workspaceId: context.get("currentWorkspaceId"),
          endpoint,
          statusCode,
          latencyMs: performance.now() - startedAt,
          requestBytes,
          responseBytes,
          rateLimited: context.get("openApiRateLimited") ?? false,
          acceptedEventCount:
            context.get("openApiAcceptedEventCount") ?? 0,
          rejectedEventCount:
            context.get("openApiRejectedEventCount") ?? 0,
        })
        .catch((error: unknown) => {
          context.get("logger").warn(
            { event: "openapi.usage.record_failed", err: error },
            "OpenAPI usage aggregation failed",
          );
        });
    }
  });
}

/** Content-Length가 없거나 잘못된 경우 크기를 0으로 처리합니다. */
function readContentLength(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}
