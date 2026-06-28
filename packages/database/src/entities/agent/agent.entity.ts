import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { WorkspaceEntity } from "../organization/workspace.entity";
import { SessionEntity } from "../session/session.entity";
import { GuardrailViolationEntity } from "../guardrail/violation.entity";

@Entity("agent")
export class AgentEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  description?: string;

  @Column()
  defaultModel!: string;

  @ManyToOne(() => WorkspaceEntity, (workspace) => workspace.agents, {
    onDelete: "CASCADE",
  })
  workspace!: WorkspaceEntity;

  @OneToMany(() => SessionEntity, (session) => session.agent)
  sessions!: SessionEntity[];

  @OneToMany(() => GuardrailViolationEntity, (blocked) => blocked.agent)
  blocked!: GuardrailViolationEntity[];
}
