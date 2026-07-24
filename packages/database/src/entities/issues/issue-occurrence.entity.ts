import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AgentEntity } from "../agent/agent.entity";
import { EventEntity } from "../event/event.entity";
import { GuardrailPolicyEntity } from "../guardrail/policy.entity";
import { GuardrailViolationEntity } from "../guardrail/violation.entity";
import { WorkspaceEntity } from "../organization/workspace.entity";
import { PromptVersionEntity } from "../prompt/prompt-version.entity";
import { SessionEntity } from "../session/session.entity";
import { IssueEntity } from "./issue.entity";
import { IssueEvaluationEntity } from "./issue-evaluation.entity";
import { IssueRecordEntity } from "./issue-record.entity";

@Entity("issue_occurrence")
@Index("UQ_issue_occurrence_workspace_client_id", [
  "workspaceId",
  "clientOccurrenceId",
], { unique: true })
@Index("IDX_issue_occurrence_issue_detected", ["issueId", "detectedAt", "id"])
@Index("IDX_issue_occurrence_workspace_detected", [
  "workspaceId",
  "detectedAt",
  "id",
])
@Index("IDX_issue_occurrence_session_detected", ["sessionId", "detectedAt"])
export class IssueOccurrenceEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "uuid" })
  issueId!: string;

  @Column({ type: "uuid" })
  sessionId!: string;

  @Column({ type: "uuid", nullable: true })
  eventId!: string | null;

  @Column({ type: "uuid", nullable: true })
  guardrailViolationId!: string | null;

  @Column({ type: "uuid", nullable: true })
  agentId!: string | null;

  @Column({ type: "bigint", nullable: true })
  policyId!: string | null;

  @Column({ type: "uuid", nullable: true })
  promptVersionId!: string | null;

  @Column({ type: "uuid", nullable: true })
  recordId!: string | null;

  @Column({ type: "uuid", nullable: true })
  evaluationId!: string | null;

  @Column({ type: "varchar", length: 30 })
  environment!: string;

  @Column({ type: "boolean", default: false })
  isBlocked!: boolean;

  @Column({ type: "timestamptz" })
  detectedAt!: Date;

  @Column({ type: "jsonb", nullable: true })
  evidence!: Record<string, unknown> | null;

  @Column({ type: "varchar", length: 40 })
  detectorVersion!: string;

  @Column({ type: "varchar", length: 120, nullable: true })
  clientOccurrenceId!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @ManyToOne(() => WorkspaceEntity, { onDelete: "CASCADE" })
  @JoinColumn({
    name: "workspaceId",
    foreignKeyConstraintName: "FK_issue_occurrence_workspace",
  })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => IssueEntity, { onDelete: "CASCADE" })
  @JoinColumn({
    name: "issueId",
    foreignKeyConstraintName: "FK_issue_occurrence_issue",
  })
  issue!: IssueEntity;

  @ManyToOne(() => SessionEntity, { onDelete: "CASCADE" })
  @JoinColumn({
    name: "sessionId",
    foreignKeyConstraintName: "FK_issue_occurrence_session",
  })
  session!: SessionEntity;

  @ManyToOne(() => EventEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "eventId",
    foreignKeyConstraintName: "FK_issue_occurrence_event",
  })
  event!: EventEntity | null;

  @ManyToOne(() => GuardrailViolationEntity, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({
    name: "guardrailViolationId",
    foreignKeyConstraintName: "FK_issue_occurrence_guardrail_violation",
  })
  guardrailViolation!: GuardrailViolationEntity | null;

  @ManyToOne(() => AgentEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "agentId",
    foreignKeyConstraintName: "FK_issue_occurrence_agent",
  })
  agent!: AgentEntity | null;

  @ManyToOne(() => GuardrailPolicyEntity, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({
    name: "policyId",
    foreignKeyConstraintName: "FK_issue_occurrence_policy",
  })
  policy!: GuardrailPolicyEntity | null;

  @ManyToOne(() => PromptVersionEntity, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({
    name: "promptVersionId",
    foreignKeyConstraintName: "FK_issue_occurrence_prompt_version",
  })
  promptVersion!: PromptVersionEntity | null;

  @ManyToOne(() => IssueRecordEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "recordId",
    foreignKeyConstraintName: "FK_issue_occurrence_record",
  })
  record!: IssueRecordEntity | null;

  @ManyToOne(() => IssueEvaluationEntity, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({
    name: "evaluationId",
    foreignKeyConstraintName: "FK_issue_occurrence_evaluation",
  })
  evaluation!: IssueEvaluationEntity | null;
}
