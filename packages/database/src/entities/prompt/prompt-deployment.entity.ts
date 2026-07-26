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
import { PromptVersionEntity } from "./prompt-version.entity";

@Entity("prompt_deployment")
@Index("IDX_prompt_deployment_scope_active", [
  "workspaceId",
  "promptId",
  "environment",
  "agentId",
  "active",
])
export class PromptDeploymentEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "uuid" })
  promptId!: string;

  @Column({ type: "uuid" })
  versionId!: string;

  @Column({ type: "varchar", length: 30 })
  environment!: string;

  @Column({ type: "uuid", nullable: true })
  agentId!: string | null;

  @Column({ type: "boolean", default: true })
  active!: boolean;

  @Column({ type: "uuid", nullable: true })
  supersedesDeploymentId!: string | null;

  @Column({ type: "text", nullable: true })
  reason!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  deployedAt!: Date;

  @Column({ type: "uuid", nullable: true })
  deployedByUserId!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  supersededAt!: Date | null;

  @ManyToOne(() => WorkspaceEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "workspaceId" })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => PromptEntity, (prompt) => prompt.deployments, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "promptId" })
  prompt!: PromptEntity;

  @ManyToOne(() => PromptVersionEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "versionId" })
  version!: PromptVersionEntity;

  @ManyToOne(() => AgentEntity, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "agentId" })
  agent!: AgentEntity | null;
}
