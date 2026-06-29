import { WORKSPACE_PLANS } from "@repo/constants";
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AgentEntity } from "../agent/agent.entity";
import { GuardrailPolicyEntity } from "../guardrail/policy.entity";
import { PromptVersionEntity } from "../prompt/prompt-version.entity";
import { SessionEntity } from "../session/session.entity";
import { WorkspaceApiKeyEntity } from "../workspace/workspace-api-key.entity";
import { WorkspacePlanEntity } from "../workspace/workspace-plan.entity";
import { OrganizationEntity } from "./organization.entity";

@Entity("workspace")
export class WorkspaceEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string;

  @Column({ type: "varchar", default: WORKSPACE_PLANS.FREE })
  plan!: string;

  @ManyToOne(
    () => WorkspacePlanEntity,
    (plan: WorkspacePlanEntity) => plan.workspaces,
    {
      eager: true,
      nullable: true,
    },
  )
  @JoinColumn({ name: "plan", referencedColumnName: "code" })
  planConfig?: WorkspacePlanEntity;

  @Column({ type: "varchar", nullable: true, unique: true })
  apiKey?: string;

  @OneToMany(
    () => WorkspaceApiKeyEntity,
    (apiKey: WorkspaceApiKeyEntity) => apiKey.workspace,
  )
  apiKeys!: WorkspaceApiKeyEntity[];

  @ManyToOne(
    () => OrganizationEntity,
    (organization: OrganizationEntity) => organization.workspaces,
    {
      onDelete: "CASCADE",
    },
  )
  organization!: OrganizationEntity;

  @OneToMany(() => AgentEntity, (agent: AgentEntity) => agent.workspace, {
    onDelete: "CASCADE",
  })
  agents!: AgentEntity[];

  @OneToMany(() => SessionEntity, (session: SessionEntity) => session.workspace)
  sessions!: SessionEntity[];

  @OneToMany(
    () => PromptVersionEntity,
    (prompt: PromptVersionEntity) => prompt.workspace,
  )
  prompts!: PromptVersionEntity[];

  @OneToMany(
    () => GuardrailPolicyEntity,
    (guardrailPolicy: GuardrailPolicyEntity) => guardrailPolicy.workspace,
  )
  guardrailPolicy!: GuardrailPolicyEntity[];
}
