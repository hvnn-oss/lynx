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
import { WorkspaceEntity } from "../organization/workspace.entity";
import { PromptEntity } from "./prompt.entity";

export interface PromptExperimentVariant {
  versionId: string;
  weight: number;
}

@Entity("prompt_experiment")
@Index("IDX_prompt_experiment_scope_status", [
  "workspaceId",
  "promptId",
  "environment",
  "agentId",
  "status",
])
export class PromptExperimentEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "uuid" })
  promptId!: string;

  @Column({ type: "varchar", length: 120 })
  name!: string;

  @Column({ type: "varchar", length: 30 })
  environment!: string;

  @Column({ type: "uuid", nullable: true })
  agentId!: string | null;

  @Column({ type: "jsonb" })
  variants!: PromptExperimentVariant[];

  @Column({ type: "varchar", length: 20, default: "DRAFT" })
  status!: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";

  @Column({ type: "varchar", length: 64 })
  assignmentSalt!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @Column({ type: "uuid" })
  createdByUserId!: string;

  @Column({ type: "timestamptz", nullable: true })
  startedAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  endedAt!: Date | null;

  @ManyToOne(() => WorkspaceEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "workspaceId" })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => PromptEntity, (prompt) => prompt.experiments, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "promptId" })
  prompt!: PromptEntity;

  @ManyToOne(() => AgentEntity, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "agentId" })
  agent!: AgentEntity | null;
}
