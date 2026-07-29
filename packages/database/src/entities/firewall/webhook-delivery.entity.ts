import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import type {
  WebhookDeliveryProvider,
  WebhookDeliveryStatus,
} from "@repo/constants";
import { WorkspaceEntity } from "../organization/workspace.entity";
import { FirewallPolicyEntity } from "./policy.entity";

/** Webhook 이벤트를 외부 전송 전에 영속화하는 Outbox 레코드입니다. */
@Entity("webhook_delivery")
@Index("UQ_webhook_delivery_deduplication_key", ["deduplicationKey"], {
  unique: true,
})
@Index("IDX_webhook_delivery_dispatch", ["status", "nextAttemptAt"])
@Index("IDX_webhook_delivery_workspace_created", ["workspaceId", "createdAt"])
@Index("IDX_webhook_delivery_policy_created", ["policyId", "createdAt"])
export class WebhookDeliveryEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  /** 수신 측이 재전송을 중복 제거할 때 사용하는 안정적인 이벤트 ID입니다. */
  @Column({ type: "uuid", unique: true })
  eventId!: string;

  /** 동일 도메인 이벤트가 Outbox에 두 번 생성되지 않도록 보장합니다. */
  @Column({ type: "varchar", length: 255 })
  deduplicationKey!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "bigint", nullable: true })
  policyId!: string | null;

  @Column({ type: "integer", nullable: true })
  policyRevision!: number | null;

  @Column({ type: "text" })
  destinationUrl!: string;

  @Column({ type: "varchar", length: 80 })
  eventType!: string;

  @Column({ type: "varchar", length: 24, default: "GENERIC" })
  provider!: WebhookDeliveryProvider;

  @Column({ type: "timestamptz" })
  occurredAt!: Date;

  @Column({ type: "jsonb" })
  data!: Record<string, unknown>;

  @Column({ type: "varchar", length: 24, default: "PENDING" })
  status!: WebhookDeliveryStatus;

  @Column({ type: "integer", default: 0 })
  attemptCount!: number;

  @Column({ type: "integer", default: 8 })
  maxAttempts!: number;

  @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
  nextAttemptAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  lockedAt!: Date | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  lockedBy!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  lastAttemptAt!: Date | null;

  @Column({ type: "integer", nullable: true })
  responseStatus!: number | null;

  @Column({ type: "varchar", length: 1_000, nullable: true })
  lastError!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  deliveredAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @ManyToOne(() => WorkspaceEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "workspaceId" })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => FirewallPolicyEntity, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "policyId" })
  policy!: FirewallPolicyEntity | null;
}
