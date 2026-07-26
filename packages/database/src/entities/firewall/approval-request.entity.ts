import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { FirewallApprovalStatus } from "@repo/constants";
import { FirewallPolicyEntity } from "./policy.entity";
import { WorkspaceEntity } from "../organization/workspace.entity";
import { UserEntity } from "../organization/user.entity";

@Entity("firewall_approval_request")
@Index(
  "UQ_firewall_approval_client_request",
  ["workspaceId", "sdkInstanceId", "clientRequestId"],
  { unique: true },
)
@Index("IDX_firewall_approval_workspace_status", [
  "workspaceId",
  "status",
  "requestedAt",
])
export class FirewallApprovalRequestEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "bigint", nullable: true })
  policyId!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  reportedPolicyId!: string | null;

  @Column({ type: "varchar", length: 120 })
  sdkInstanceId!: string;

  @Column({ type: "varchar", length: 160 })
  clientRequestId!: string;

  @Column({ type: "varchar", length: 255 })
  runId!: string;

  @Column({ type: "varchar", length: 255 })
  sessionId!: string;

  @Column({ type: "varchar", length: 255 })
  agentId!: string;

  @Column({ type: "varchar", length: 255 })
  toolName!: string;

  @Column({ type: "varchar", length: 64 })
  inputHash!: string;

  @Column({ type: "varchar", length: 20, default: "PENDING" })
  status!: FirewallApprovalStatus;

  @Column({ type: "text", nullable: true })
  requestReason!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  requestedAt!: Date;

  @Column({ type: "timestamptz" })
  expiresAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  decidedAt!: Date | null;

  @Column({ type: "uuid", nullable: true })
  decidedByUserId!: string | null;

  @Column({ type: "text", nullable: true })
  decisionReason!: string | null;

  @ManyToOne(() => WorkspaceEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "workspaceId" })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => FirewallPolicyEntity, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "policyId" })
  policy!: FirewallPolicyEntity | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "decidedByUserId" })
  decidedBy!: UserEntity | null;
}
