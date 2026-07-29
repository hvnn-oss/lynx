import type { SlackNotificationEventType } from "@repo/constants";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { WorkspaceEntity } from "../organization/workspace.entity";

/** 워크스페이스의 Slack Incoming Webhook 설정과 알림 범위를 저장합니다. */
@Entity("slack_integration")
@Index("UQ_slack_integration_workspace", ["workspaceId"], { unique: true })
export class SlackIntegrationEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  /** Slack URL은 외부에 노출되지 않도록 AES-GCM 암호문으로만 저장합니다. */
  @Column({ type: "text" })
  webhookUrlCiphertext!: string;

  @Column({ type: "varchar", length: 80, nullable: true })
  displayName!: string | null;

  @Column({ type: "boolean", default: true })
  isEnabled!: boolean;

  @Column({ type: "jsonb" })
  eventTypes!: SlackNotificationEventType[];

  @Column({ type: "uuid", nullable: true })
  updatedByUserId!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @OneToOne(() => WorkspaceEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "workspaceId" })
  workspace!: WorkspaceEntity;
}
