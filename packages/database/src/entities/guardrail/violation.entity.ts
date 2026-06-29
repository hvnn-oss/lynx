import { type GuardrailActions } from "@repo/constants";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { SessionEntity } from "../session/session.entity";
import { AgentEntity } from "../agent/agent.entity";
import { GuardrailPolicyEntity } from "./policy.entity";

@Entity("guardrail-violation")
export class GuardrailViolationEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  action!: GuardrailActions;

  @Column()
  createdAt!: Date;

  @ManyToOne(() => GuardrailPolicyEntity, (reason: GuardrailPolicyEntity) => reason.blocked)
  reason!: GuardrailPolicyEntity;

  @ManyToOne(() => SessionEntity, (session: SessionEntity) => session.blocked, {
    onDelete: "CASCADE",
  })
  session!: SessionEntity;

  @ManyToOne(() => AgentEntity, (agent: AgentEntity) => agent.blocked)
  agent!: AgentEntity;
}
