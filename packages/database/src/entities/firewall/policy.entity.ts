import {
  FIREWALL_ACTIONS,
  FIREWALL_SEVERITY,
  type FirewallActions,
  type FirewallSeverity,
} from "@repo/constants";
import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { WorkspaceEntity } from "../organization/workspace.entity";
import { FirewallViolationEntity } from "./violation.entity";
import { FirewallPolicyRevisionEntity } from "./policy-revision.entity";

@Entity("firewall-policy")
export class FirewallPolicyEntity {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: number;

  @Column()
  name!: string;

  @Column({ type: "varchar", nullable: true })
  description!: string | null;

  @Column()
  condition!: string;

  @Column({ type: "varchar", default: FIREWALL_SEVERITY.MEDIUM })
  severity!: FirewallSeverity;

  @Column({ type: "varchar", default: FIREWALL_ACTIONS.WARN })
  action!: FirewallActions;

  @Column({ default: "0.0" })
  version!: string;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;

  @Column({ default: false })
  activated!: boolean;

  @Column({ type: "integer", default: 1 })
  draftRevision!: number;

  @Column({ type: "integer", nullable: true })
  deployedRevision!: number | null;

  @Column({ type: "timestamptz", nullable: true })
  deletedAt!: Date | null;

  @Column({ type: "varchar", length: 2048, nullable: true })
  webhookUrl!: string | null;

  @ManyToOne(() => WorkspaceEntity, (workspace: WorkspaceEntity) => workspace)
  workspace!: WorkspaceEntity;

  @OneToMany(
    () => FirewallViolationEntity,
    (blocked: FirewallViolationEntity) => blocked.reason,
  )
  blocked!: FirewallViolationEntity[];

  @OneToMany(() => FirewallPolicyRevisionEntity, (revision) => revision.policy)
  revisions!: FirewallPolicyRevisionEntity[];
}
