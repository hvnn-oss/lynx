import {
  GUARDRAIL_ACTIONS,
  GUARDRAIL_SERVERITY,
  type GuardrailActions,
  type GuardrailServerity,
} from "@repo/constants";
import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { WorkspaceEntity } from "../organization/workspace.entity";
import { GuardrailViolationEntity } from "./violation.entity";

@Entity("guardrail-policy")
export class GuardrailPolicyEntity {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: number;

  @Column()
  name!: string;

  @Column({ nullable: true })
  description?: string;

  @Column()
  condition!: string;

  @Column({ type: "varchar", default: GUARDRAIL_SERVERITY.MEDIUM })
  serverity!: GuardrailServerity;

  @Column({ type: "varchar", default: GUARDRAIL_ACTIONS.WARN })
  action!: GuardrailActions;

  @Column({ default: "0.0" })
  version!: string;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;

  @Column({ default: false })
  activated!: boolean;

  @ManyToOne(() => WorkspaceEntity, (workspace: WorkspaceEntity) => workspace)
  workspace!: WorkspaceEntity;

  @OneToMany(
    () => GuardrailViolationEntity,
    (blocked: GuardrailViolationEntity) => blocked.reason,
  )
  blocked!: GuardrailViolationEntity[];
}
