import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { GuardrailViolationEntity } from "../guardrail/violation.entity";
import { WorkspaceEntity } from "../organization/workspace.entity";
import { SessionEntity } from "../session/session.entity";

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
    () => GuardrailViolationEntity,
    (blocked: GuardrailViolationEntity) => blocked.agent,
  )
  blocked!: GuardrailViolationEntity[];
}
