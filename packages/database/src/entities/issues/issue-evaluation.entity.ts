import type { IssueEvaluationPipeline } from "@repo/constants";
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
import { PromptVersionEntity } from "../prompt/prompt-version.entity";
import { WorkspaceEntity } from "../organization/workspace.entity";
import { IssueEntity } from "./issue.entity";
import { IssueRecordEntity } from "./issue-record.entity";

@Entity("issue_evaluation")
@Check(
  "CHK_issue_evaluation_pipeline",
  `"pipeline" IN ('DETECTION', 'RESOLUTION')`,
)
@Check(
  "CHK_issue_evaluation_confidence",
  `"confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1)`,
)
@Index("UQ_issue_evaluation_record_number", ["recordId", "evaluationNumber"], {
  unique: true,
})
@Index("IDX_issue_evaluation_stable_fingerprint", [
  "workspaceId",
  "stableFingerprintVersion",
  "stableFingerprint",
])
@Index("IDX_issue_evaluation_matched_issue_created", [
  "workspaceId",
  "matchedIssueId",
  "createdAt",
  "id",
])
export class IssueEvaluationEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "uuid" })
  recordId!: string;

  @Column({ type: "integer" })
  evaluationNumber!: number;

  @Column({ type: "varchar", length: 20 })
  pipeline!: IssueEvaluationPipeline;

  @Column({ type: "varchar", length: 40 })
  action!: string;

  @Column({ type: "varchar", length: 80 })
  reasonCode!: string;

  @Column({ type: "text" })
  summary!: string;

  @Column({ type: "real", nullable: true })
  confidence!: number | null;

  @Column({ type: "char", length: 64, nullable: true })
  stableFingerprint!: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  stableFingerprintVersion!: string | null;

  @Column({ type: "char", length: 64, nullable: true })
  exactFingerprint!: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  exactFingerprintVersion!: string | null;

  @Column({ type: "uuid", nullable: true })
  matchedIssueId!: string | null;

  @Column({ type: "uuid", nullable: true })
  verifiedPromptVersionId!: string | null;

  @Column({ type: "jsonb" })
  evidence!: Record<string, unknown>;

  @Column({ type: "jsonb", nullable: true })
  reevaluateWhen!: Record<string, unknown> | null;

  @Column({ type: "varchar", length: 80 })
  evaluatorName!: string;

  @Column({ type: "varchar", length: 40 })
  evaluatorVersion!: string;

  @Column({ type: "varchar", length: 40 })
  ruleSetVersion!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @ManyToOne(() => IssueRecordEntity, { onDelete: "CASCADE" })
  @JoinColumn({
    name: "recordId",
    foreignKeyConstraintName: "FK_issue_evaluation_record",
  })
  record!: IssueRecordEntity;

  @ManyToOne(() => WorkspaceEntity, { onDelete: "CASCADE" })
  @JoinColumn({
    name: "workspaceId",
    foreignKeyConstraintName: "FK_issue_evaluation_workspace",
  })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => IssueEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "matchedIssueId",
    foreignKeyConstraintName: "FK_issue_evaluation_matched_issue",
  })
  matchedIssue!: IssueEntity | null;

  @ManyToOne(() => PromptVersionEntity, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({
    name: "verifiedPromptVersionId",
    foreignKeyConstraintName: "FK_issue_evaluation_prompt_version",
  })
  verifiedPromptVersion!: PromptVersionEntity | null;
}
