import type { MigrationInterface, QueryRunner } from "typeorm";

/** API Key별 OpenAPI 사용량을 시간 단위로 보존하는 집계 테이블을 추가합니다. */
export class AddOpenApiApiKeyUsage1785312000000
  implements MigrationInterface
{
  name = "AddOpenApiApiKeyUsage1785312000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "openapi_api_key_usage_hourly" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "apiKeyId" uuid NOT NULL,
        "workspaceId" uuid NOT NULL,
        "bucketStartedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "endpoint" character varying(200) NOT NULL,
        "requestCount" integer NOT NULL DEFAULT 0,
        "successCount" integer NOT NULL DEFAULT 0,
        "clientErrorCount" integer NOT NULL DEFAULT 0,
        "serverErrorCount" integer NOT NULL DEFAULT 0,
        "rateLimitedCount" integer NOT NULL DEFAULT 0,
        "acceptedEventCount" integer NOT NULL DEFAULT 0,
        "rejectedEventCount" integer NOT NULL DEFAULT 0,
        "requestBytes" bigint NOT NULL DEFAULT 0,
        "responseBytes" bigint NOT NULL DEFAULT 0,
        "totalLatencyMs" bigint NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_openapi_api_key_usage_hourly" PRIMARY KEY ("id"),
        CONSTRAINT "FK_openapi_usage_api_key"
          FOREIGN KEY ("apiKeyId") REFERENCES "workspace_api_key"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_openapi_usage_workspace"
          FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_openapi_usage_key_bucket_endpoint"
      ON "openapi_api_key_usage_hourly"
      ("apiKeyId", "bucketStartedAt", "endpoint")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_openapi_usage_workspace_bucket"
      ON "openapi_api_key_usage_hourly" ("workspaceId", "bucketStartedAt")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_openapi_usage_key_bucket"
      ON "openapi_api_key_usage_hourly" ("apiKeyId", "bucketStartedAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "openapi_api_key_usage_hourly"`);
  }
}
