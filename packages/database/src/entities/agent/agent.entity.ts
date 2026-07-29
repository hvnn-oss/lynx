import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { FirewallViolationEntity } from "../firewall/violation.entity";
import { WorkspaceEntity } from "../organization/workspace.entity";
import { SessionEntity } from "../session/session.entity";

@Entity("agent")
@Index("IDX_agent_workspace_name", { synchronize: false })
export class AgentEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  clientAgentId?: string;

  @Column({ nullable: true })
  description?: string;

  @Column()
  defaultModel!: string;

  @ManyToOne(
    () => WorkspaceEntity,
    (workspace: WorkspaceEntity) => workspace.agents,
    {
      onDelete: "CASCADE",
    },
  )
  workspace!: WorkspaceEntity;

  @OneToMany(() => SessionEntity, (session: SessionEntity) => session.agent)
  sessions!: SessionEntity[];

  @OneToMany(
    () => FirewallViolationEntity,
    (blocked: FirewallViolationEntity) => blocked.agent,
  )
  blocked!: FirewallViolationEntity[];
}
