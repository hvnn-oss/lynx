import {
  ISSUE_FINGERPRINT_VERSION,
  ISSUE_SEVERITY,
  ISSUE_STATUS,
  type IssueActorType,
  type IssueCategory,
  type IssueFingerprintVersion,
  type IssueSeverity,
  type IssueSource,
  type IssueStatus,
} from "@repo/constants";
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { AgentEntity } from "../agent/agent.entity";
import { GuardrailPolicyEntity } from "../guardrail/policy.entity";
import { WorkspaceEntity } from "../organization/workspace.entity";
import { PromptVersionEntity } from "../prompt/prompt-version.entity";
import { UserEntity } from "../organization/user.entity";
import { IssueOccurrenceEntity } from "./issue-occurrence.entity";

@Entity("issue")
@Check(
  "CHK_issue_stable_fingerprint_sha256",
  `"stableFingerprint" ~ '^[0-9a-f]{64}$'`,
)
@Check(
  "CHK_issue_exact_fingerprint_sha256",
  `"exactFingerprint" ~ '^[0-9a-f]{64}$'`,
)
@Check(
  "CHK_issue_severity",
  `"severity" IN ('CRITICAL', 'WARNING', 'INFO')`,
)
@Check(
  "CHK_issue_status",
  `"status" IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'IGNORED')`,
)
@Check(
  "CHK_issue_source",
  `"source" IN ('SDK', 'POLICY', 'DETECTOR', 'USER')`,
)
@Check(
  "CHK_issue_category",
  `"category" IN ('TOOL_RISK', 'GUARDRAIL', 'LOOP', 'MODEL_ERROR', 'PROMPT_REGRESSION', 'LATENCY', 'COST', 'DATA_EXPOSURE')`,
)
@Check(
  "CHK_issue_reporter_type",
  `"reporterType" IN ('USER', 'SDK', 'SYSTEM')`,
)
@Check(
  "CHK_issue_counts",
  `"occurrenceCount" >= 0 AND "affectedSessionCount" >= 0 AND "blockedOccurrenceCount" >= 0`,
)
@Index(
  "UQ_issue_workspace_exact_fingerprint",
  ["workspaceId", "exactFingerprintVersion", "exactFingerprint"],
  { unique: true },
)
@Index("IDX_issue_workspace_stable_fingerprint", [
  "workspaceId",
  "stableFingerprintVersion",
  "stableFingerprint",
])
@Index("IDX_issue_workspace_status_last_seen", [
  "workspaceId",
  "status",
  "lastSeenAt",
  "id",
])
@Index("IDX_issue_workspace_severity_last_seen", [
  "workspaceId",
  "severity",
  "lastSeenAt",
])
@Index("IDX_issue_workspace_agent_last_seen", [
  "workspaceId",
  "agentId",
  "lastSeenAt",
])
@Index("IDX_issue_workspace_blocked_last_seen", ["workspaceId", "lastSeenAt"], {
  where: `"blockedOccurrenceCount" > 0`,
})
export class IssueEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "char", length: 64 })
  stableFingerprint!: string;

  @Column({
    type: "varchar",
    length: 20,
    default: ISSUE_FINGERPRINT_VERSION.V1,
  })
  stableFingerprintVersion!: IssueFingerprintVersion;

  @Column({ type: "char", length: 64 })
  exactFingerprint!: string;

  @Column({
    type: "varchar",
    length: 20,
    default: ISSUE_FINGERPRINT_VERSION.V1,
  })
  exactFingerprintVersion!: IssueFingerprintVersion;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "text" })
  summary!: string;

  @Column({ type: "varchar", length: 40 })
  category!: IssueCategory;

  @Column({
    type: "varchar",
    length: 20,
    default: ISSUE_SEVERITY.WARNING,
  })
  severity!: IssueSeverity;

  @Column({ type: "varchar", length: 20, default: ISSUE_STATUS.OPEN })
  status!: IssueStatus;

  @Column({ type: "varchar", length: 20 })
  source!: IssueSource;

  @Column({ type: "varchar", length: 30 })
  environment!: string;

  @Column({ type: "uuid", nullable: true })
  agentId!: string | null;

  @Column({ type: "bigint", nullable: true })
  policyId!: string | null;

  @Column({ type: "uuid", nullable: true })
  representativePromptVersionId!: string | null;

  @Column({ type: "uuid", nullable: true })
  representativeOccurrenceId!: string | null;

  @Column({ type: "varchar", length: 30 })
  reporterType!: IssueActorType;

  @Column({ type: "uuid", nullable: true })
  reporterUserId!: string | null;

  @Column({ type: "varchar", length: 120 })
  reporterName!: string;

  @Column({ type: "timestamptz" })
  firstSeenAt!: Date;

  @Column({ type: "timestamptz" })
  lastSeenAt!: Date;

  @Column({ type: "integer", default: 0 })
  occurrenceCount!: number;

  @Column({ type: "integer", default: 0 })
  affectedSessionCount!: number;

  @Column({ type: "integer", default: 0 })
  blockedOccurrenceCount!: number;

  @Column({ type: "jsonb", default: [] })
  riskSignals!: string[];

  @Column({ type: "jsonb", default: [] })
  reproductionSteps!: string[];

  @Column({ type: "text", array: true, default: [] })
  tags!: string[];

  @Column({ type: "timestamptz", nullable: true })
  resolvedAt!: Date | null;

  @Column({ type: "uuid", nullable: true })
  resolvedByUserId!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @ManyToOne(() => WorkspaceEntity, { onDelete: "CASCADE" })
  @JoinColumn({
    name: "workspaceId",
    foreignKeyConstraintName: "FK_issue_workspace",
  })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => AgentEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "agentId",
    foreignKeyConstraintName: "FK_issue_agent",
  })
  agent!: AgentEntity | null;

  @ManyToOne(() => GuardrailPolicyEntity, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({
    name: "policyId",
    foreignKeyConstraintName: "FK_issue_policy",
  })
  policy!: GuardrailPolicyEntity | null;

  @ManyToOne(() => PromptVersionEntity, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({
    name: "representativePromptVersionId",
    foreignKeyConstraintName: "FK_issue_prompt_version",
  })
  representativePromptVersion!: PromptVersionEntity | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "reporterUserId",
    foreignKeyConstraintName: "FK_issue_reporter_user",
  })
  reporterUser!: UserEntity | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "resolvedByUserId",
    foreignKeyConstraintName: "FK_issue_resolved_by_user",
  })
  resolvedByUser!: UserEntity | null;

  @ManyToOne(() => IssueOccurrenceEntity, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({
    name: "representativeOccurrenceId",
    foreignKeyConstraintName: "FK_issue_representative_occurrence",
  })
  representativeOccurrence!: IssueOccurrenceEntity | null;
}
