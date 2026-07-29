import type { DataSource } from "typeorm";
import { AppDataSource } from "../../provider/database/typeorm-config.js";

export interface RecordOpenApiUsageInput {
  apiKeyId: string;
  workspaceId: string;
  endpoint: string;
  statusCode: number;
  latencyMs: number;
  requestBytes: number;
  responseBytes: number;
  rateLimited: boolean;
  acceptedEventCount: number;
  rejectedEventCount: number;
  occurredAt?: Date;
}

/**
 * OpenAPI 요청을 API Key·엔드포인트·시간 단위 집계로 누적합니다.
 *
 * 원본 요청과 응답은 저장하지 않아 인증 정보와 고객 payload가 관리 통계에
 * 섞이지 않도록 합니다.
 */
export class OpenApiUsageService {
  constructor(
    private readonly dataSource: Pick<DataSource, "query"> = AppDataSource,
  ) {}

  /** 하나의 요청 결과를 멱등하지 않은 증가 집계로 기록합니다. */
  async record(input: RecordOpenApiUsageInput): Promise<void> {
    const bucketStartedAt = this.toHourBucket(input.occurredAt ?? new Date());
    const isSuccess = input.statusCode >= 200 && input.statusCode < 400;
    const isClientError = input.statusCode >= 400 && input.statusCode < 500;
    const isServerError = input.statusCode >= 500;

    await this.dataSource.query(
      `
        INSERT INTO "openapi_api_key_usage_hourly" (
          "apiKeyId",
          "workspaceId",
          "bucketStartedAt",
          "endpoint",
          "requestCount",
          "successCount",
          "clientErrorCount",
          "serverErrorCount",
          "rateLimitedCount",
          "acceptedEventCount",
          "rejectedEventCount",
          "requestBytes",
          "responseBytes",
          "totalLatencyMs"
        )
        VALUES ($1, $2, $3, $4, 1, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT ("apiKeyId", "bucketStartedAt", "endpoint")
        DO UPDATE SET
          "requestCount" = "openapi_api_key_usage_hourly"."requestCount" + 1,
          "successCount" = "openapi_api_key_usage_hourly"."successCount" + EXCLUDED."successCount",
          "clientErrorCount" = "openapi_api_key_usage_hourly"."clientErrorCount" + EXCLUDED."clientErrorCount",
          "serverErrorCount" = "openapi_api_key_usage_hourly"."serverErrorCount" + EXCLUDED."serverErrorCount",
          "rateLimitedCount" = "openapi_api_key_usage_hourly"."rateLimitedCount" + EXCLUDED."rateLimitedCount",
          "acceptedEventCount" = "openapi_api_key_usage_hourly"."acceptedEventCount" + EXCLUDED."acceptedEventCount",
          "rejectedEventCount" = "openapi_api_key_usage_hourly"."rejectedEventCount" + EXCLUDED."rejectedEventCount",
          "requestBytes" = "openapi_api_key_usage_hourly"."requestBytes" + EXCLUDED."requestBytes",
          "responseBytes" = "openapi_api_key_usage_hourly"."responseBytes" + EXCLUDED."responseBytes",
          "totalLatencyMs" = "openapi_api_key_usage_hourly"."totalLatencyMs" + EXCLUDED."totalLatencyMs",
          "updatedAt" = now()
      `,
      [
        input.apiKeyId,
        input.workspaceId,
        bucketStartedAt,
        input.endpoint.slice(0, 200),
        isSuccess ? 1 : 0,
        isClientError ? 1 : 0,
        isServerError ? 1 : 0,
        input.rateLimited ? 1 : 0,
        this.toNonNegativeInteger(input.acceptedEventCount),
        this.toNonNegativeInteger(input.rejectedEventCount),
        this.toNonNegativeInteger(input.requestBytes),
        this.toNonNegativeInteger(input.responseBytes),
        this.toNonNegativeInteger(input.latencyMs),
      ],
    );
  }

  /** 서로 다른 서버 인스턴스에서도 같은 UTC 시간 구간에 누적되게 맞춥니다. */
  private toHourBucket(value: Date): Date {
    const bucket = new Date(value);
    bucket.setUTCMinutes(0, 0, 0);
    return bucket;
  }

  /** 외부 헤더와 실행 시간에서 유효한 증가값만 집계합니다. */
  private toNonNegativeInteger(value: number): number {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  }
}

export const openApiUsageService = new OpenApiUsageService();
