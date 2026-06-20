import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { WORKSPACE_PLANS, type WorkspacePlans } from "@repo/constants";
import { AgentEntity } from "../agent/agent.entity";
import { OrganizationEntity } from "./organization.entity";
import { SessionEntity } from "../session/session.entity";
import { PromptVersionEntity } from "../prompt/prompt-version.entity";
import { GuardrailPolicyEntity } from "../guardrail/policy.entity";

@Entity("workspace")
export class WorkspaceEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string;

  @Column({ type: "varchar", default: WORKSPACE_PLANS.FREE })
  plan!: WorkspacePlans;

  @ManyToOne(
    () => OrganizationEntity,
    (organization) => organization.workspaces,
    {
      onDelete: "CASCADE",
    },
  )
  organization!: OrganizationEntity;

  @OneToMany(() => AgentEntity, (agent) => agent.workspace, {
    onDelete: "CASCADE",
  })
  agents!: AgentEntity[];

  @OneToMany(() => SessionEntity, (session) => session.workspace)
  sessions!: SessionEntity[];

  @OneToMany(() => PromptVersionEntity, (prompt) => prompt.workspace)
  prompts!: PromptVersionEntity[];

  @OneToMany(
    () => GuardrailPolicyEntity,
    (guardrailPolicy) => guardrailPolicy.workspace,
  )
  guardrailPolicy!: GuardrailPolicyEntity[];
}
