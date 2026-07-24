import type { IssueRecordKind } from "@repo/constants";
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { WorkspaceEntity } from "../organization/workspace.entity";

@Entity("issue_record")
@Check(
  "CHK_issue_record_kind",
  `"recordKind" IN ('DETECTION', 'RECOVERY')`,
)
@Index(
  "UQ_issue_record_client_identity",
  ["workspaceId", "sdkInstanceId", "clientRecordId"],
  { unique: true },
)
@Index("IDX_issue_record_workspace_detected", [
  "workspaceId",
  "detectedAt",
  "id",
])
export class IssueRecordEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "varchar", length: 120 })
  sdkInstanceId!: string;

  @Column({ type: "varchar", length: 160 })
  clientRecordId!: string;

  @Column({ type: "varchar", length: 20 })
  recordKind!: IssueRecordKind;

  @Column({ type: "varchar", length: 50 })
  detectionType!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  clientRunId!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  clientSessionId!: string | null;

  @Column({ type: "varchar", length: 160, nullable: true })
  clientEventId!: string | null;

  @Column({ type: "varchar", length: 255 })
  clientAgentId!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  reportedPolicyId!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  reportedPromptVersionId!: string | null;

  @Column({ type: "varchar", length: 30 })
  environment!: string;

  @Column({ type: "timestamptz" })
  detectedAt!: Date;

  @Column({ type: "jsonb" })
  payload!: Record<string, unknown>;

  @Column({ type: "jsonb", nullable: true })
  evidence!: Record<string, unknown> | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @ManyToOne(() => WorkspaceEntity, { onDelete: "CASCADE" })
  @JoinColumn({
    name: "workspaceId",
    foreignKeyConstraintName: "FK_issue_record_workspace",
  })
  workspace!: WorkspaceEntity;
}
