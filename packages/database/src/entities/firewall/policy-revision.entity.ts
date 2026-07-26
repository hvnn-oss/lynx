import {
  FIREWALL_ACTIONS,
  FIREWALL_SEVERITY,
  type FirewallActions,
  type FirewallSeverity,
} from "@repo/constants";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { FirewallPolicyEntity } from "./policy.entity";

@Entity("firewall_policy_revision")
@Index("UQ_firewall_policy_revision", ["policyId", "revision"], {
  unique: true,
})
export class FirewallPolicyRevisionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "bigint" })
  policyId!: string;

  @Column({ type: "integer" })
  revision!: number;

  @Column({ type: "varchar", length: 40 })
  version!: string;

  @Column({ type: "varchar", length: 120 })
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "text" })
  condition!: string;

  @Column({ type: "varchar", default: FIREWALL_SEVERITY.MEDIUM })
  severity!: FirewallSeverity;

  @Column({ type: "varchar", default: FIREWALL_ACTIONS.WARN })
  action!: FirewallActions;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  deployedAt!: Date | null;

  @Column({ type: "varchar", length: 2048, nullable: true })
  webhookUrl!: string | null;

  @ManyToOne(() => FirewallPolicyEntity, (policy) => policy.revisions, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "policyId" })
  policy!: FirewallPolicyEntity;
}
