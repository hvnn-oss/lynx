import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { OrganizationEntity } from "../organization/organization.entity";
import { UserEntity } from "../organization/user.entity";

@Entity("trial_claim")
@Index("IDX_trial_claim_domain", ["companyDomainHash"])
@Index("IDX_trial_claim_payment", ["paymentFingerprintHash"])
export class TrialClaimEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "uuid" }) userId!: string;
  @Column({ type: "uuid", nullable: true }) organizationId?: string | null;
  @Column({ type: "varchar", nullable: true }) companyDomainHash?: string | null;
  @Column({ type: "varchar", nullable: true }) paymentFingerprintHash?: string | null;
  @Column({ type: "varchar", default: "ACTIVE" }) status!: string;
  @Column({ type: "varchar", default: "ALLOW" }) riskDecision!: string;
  @Column({ type: "jsonb", default: [] }) decisionReasons!: string[];
  @CreateDateColumn({ type: "timestamptz" }) startedAt!: Date;
  @Column({ type: "timestamptz" }) expiresAt!: Date;

  @ManyToOne(() => UserEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: UserEntity;

  @ManyToOne(() => OrganizationEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "organizationId" })
  organization?: OrganizationEntity | null;
}
