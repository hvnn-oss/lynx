import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AgentEntity } from "../agent/agent.entity";
import { FirewallPolicyEntity } from "../firewall/policy.entity";
import { PromptVersionEntity } from "../prompt/prompt-version.entity";
import { SessionEntity } from "../session/session.entity";
import { WorkspaceApiKeyEntity } from "../workspace/workspace-api-key.entity";
import { WorkspaceMembershipEntity } from "../workspace/workspace-membership.entity";
import { OrganizationEntity } from "./organization.entity";

@Entity("workspace")
export class WorkspaceEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string;

  @OneToMany(
    () => WorkspaceApiKeyEntity,
    (apiKey: WorkspaceApiKeyEntity) => apiKey.workspace,
  )
  apiKeys!: WorkspaceApiKeyEntity[];

  @OneToMany(
    () => WorkspaceMembershipEntity,
    (membership: WorkspaceMembershipEntity) => membership.workspace,
  )
  memberships!: WorkspaceMembershipEntity[];

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
    () => FirewallPolicyEntity,
    (firewallPolicy: FirewallPolicyEntity) => firewallPolicy.workspace,
  )
  firewallPolicy!: FirewallPolicyEntity[];
}
