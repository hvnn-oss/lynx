import { SESSION_STATUS, type SessionStatus } from "@repo/constants";
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { WorkspaceEntity } from "../organization/workspace.entity";
import { AgentEntity } from "../agent/agent.entity";
import { EventEntity } from "../event/event.entity";
import { PromptEntity } from "../prompt/prompt.entity";
import { FirewallViolationEntity } from "../firewall/violation.entity";

@Entity("session")
@Index("IDX_session_workspace_name", { synchronize: false })
@Index("IDX_session_workspace_status_started_at", { synchronize: false })
@Index("IDX_session_agent_started_at", { synchronize: false })
export class SessionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string;

  @Column({ type: "varchar", length: 120, nullable: true })
  clientId?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  clientSessionId?: string;

  @Column({
    type: "varchar",
    length: 30,
    default: SESSION_STATUS.RUNNING,
  })
  status!: SessionStatus;

  @Column()
  startedAt!: Date;

  @Column({ nullable: true })
  endedAt?: Date;

  @Column()
  totalPromptTokens!: number;

  @Column()
  totalCompletionTokens!: number;

  @Column()
  totalTokens!: number;

  @Column({ type: "numeric", precision: 20, scale: 12, default: 0 })
  totalCost!: number;

  @ManyToOne(
    () => WorkspaceEntity,
    (workspace: WorkspaceEntity) => workspace.sessions,
    {
      onDelete: "CASCADE",
    },
  )
  workspace!: WorkspaceEntity;

  @ManyToOne(() => AgentEntity, (agent: AgentEntity) => agent.sessions)
  agent!: AgentEntity;

  @ManyToOne(() => PromptEntity, (prompt: PromptEntity) => prompt.sessions, {
    nullable: true,
  })
  usedPrompt?: PromptEntity;

  @OneToMany(() => EventEntity, (event: EventEntity) => event.session)
  events!: EventEntity[];

  @OneToMany(
    () => FirewallViolationEntity,
    (blocked: FirewallViolationEntity) => blocked.session,
  )
  blocked!: FirewallViolationEntity[];
}
