import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * API Key별 OpenAPI 사용량을 한 시간 단위로 집계합니다.
 *
 * 요청 payload 원문은 저장하지 않고 운영·과금에 필요한 수치만 보존합니다.
 */
@Entity("openapi_api_key_usage_hourly")
@Index(
  "UQ_openapi_usage_key_bucket_endpoint",
  ["apiKeyId", "bucketStartedAt", "endpoint"],
  { unique: true },
)
@Index("IDX_openapi_usage_workspace_bucket", [
  "workspaceId",
  "bucketStartedAt",
])
@Index("IDX_openapi_usage_key_bucket", ["apiKeyId", "bucketStartedAt"])
export class OpenApiApiKeyUsageHourlyEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  apiKeyId!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "timestamptz" })
  bucketStartedAt!: Date;

  @Column({ type: "varchar", length: 200 })
  endpoint!: string;

  @Column({ type: "integer", default: 0 })
  requestCount!: number;

  @Column({ type: "integer", default: 0 })
  successCount!: number;

  @Column({ type: "integer", default: 0 })
  clientErrorCount!: number;

  @Column({ type: "integer", default: 0 })
  serverErrorCount!: number;

  @Column({ type: "integer", default: 0 })
  rateLimitedCount!: number;

  @Column({ type: "integer", default: 0 })
  acceptedEventCount!: number;

  @Column({ type: "integer", default: 0 })
  rejectedEventCount!: number;

  @Column({ type: "bigint", default: 0 })
  requestBytes!: string;

  @Column({ type: "bigint", default: 0 })
  responseBytes!: string;

  @Column({ type: "bigint", default: 0 })
  totalLatencyMs!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
