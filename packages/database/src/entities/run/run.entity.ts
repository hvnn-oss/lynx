import { SESSION_STATUS, type SessionStatus } from "@repo/constants";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AgentEntity } from "../agent/agent.entity.js";
import { EventEntity } from "../event/event.entity.js";
import { WorkspaceEntity } from "../organization/workspace.entity.js";
import { SessionEntity } from "../session/session.entity.js";

/** 한 번의 에이전트 실행과 그 집계 상태를 저장합니다. */
@Entity("run")
@Index(
  "UQ_run_workspace_client_run",
  ["workspaceId", "clientId", "clientRunId"],
  { unique: true },
)
@Index("IDX_run_workspace_started", ["workspaceId", "startedAt", "id"])
export class RunEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "uuid" })
  sessionId!: string;

  @Column({ type: "uuid" })
  agentId!: string;

  @Column({ type: "varchar", length: 120 })
  clientId!: string;

  @Column({ type: "varchar", length: 255 })
  clientRunId!: string;

  @Column({ type: "varchar", length: 30, default: SESSION_STATUS.RUNNING })
  status!: SessionStatus;

  @Column({ type: "timestamptz" })
  startedAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  endedAt!: Date | null;

  @Column({ type: "integer", default: 0 })
  totalPromptTokens!: number;

  @Column({ type: "integer", default: 0 })
  totalCompletionTokens!: number;

  @Column({ type: "integer", default: 0 })
  totalTokens!: number;

  @Column({ type: "numeric", precision: 20, scale: 12, default: 0 })
  totalCost!: number;

  @ManyToOne(() => WorkspaceEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "workspaceId" })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => SessionEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "sessionId" })
  session!: SessionEntity;

  @ManyToOne(() => AgentEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agentId" })
  agent!: AgentEntity;

  @OneToMany(() => EventEntity, (event) => event.run)
  events!: EventEntity[];
}
