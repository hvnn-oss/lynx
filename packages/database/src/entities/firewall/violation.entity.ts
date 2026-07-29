import { type FirewallActions } from "@repo/constants";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { SessionEntity } from "../session/session.entity";
import { AgentEntity } from "../agent/agent.entity";
import { FirewallPolicyEntity } from "./policy.entity";
import { WorkspaceEntity } from "../organization/workspace.entity";
import { EventEntity } from "../event/event.entity";

@Entity("firewall-violation")
@Index("UQ_firewall_violation_event", ["eventId"], {
  unique: true,
  where: '"eventId" IS NOT NULL',
})
@Index("IDX_firewall_violation_workspace_created", { synchronize: false })
export class FirewallViolationEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  action!: FirewallActions;

  @Column()
  createdAt!: Date;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "uuid", nullable: true })
  eventId!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  reportedPolicyId!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  toolName!: string | null;

  @Column({ type: "varchar", length: 20, nullable: true })
  severity!: string | null;

  @Column({ type: "text", nullable: true })
  message!: string | null;

  @Column({ type: "jsonb", nullable: true })
  evidence!: Record<string, unknown> | null;

  @ManyToOne(
    () => FirewallPolicyEntity,
    (reason: FirewallPolicyEntity) => reason.blocked,
    { nullable: true, onDelete: "SET NULL" },
  )
  reason!: FirewallPolicyEntity | null;

  @ManyToOne(() => SessionEntity, (session: SessionEntity) => session.blocked, {
    onDelete: "CASCADE",
  })
  session!: SessionEntity;

  @ManyToOne(() => AgentEntity, (agent: AgentEntity) => agent.blocked)
  agent!: AgentEntity;

  @ManyToOne(() => WorkspaceEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "workspaceId" })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => EventEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "eventId" })
  event!: EventEntity | null;
}
