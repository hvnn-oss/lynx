import { type RiskLevel } from "@repo/constants";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { OrganizationEntity } from "./organization.entity";

@Entity("filter-policy")
export class FilterPolicyEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  type!: "PII" | "RISK";

  @Column()
  name!: string;

  @Column()
  pattern!: string;

  @Column({ default: "g" })
  flags!: string;

  @Column({ nullable: true })
  replacement?: string;

  @Column({ type: "varchar", nullable: true })
  riskLevel?: RiskLevel;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;

  @Column({ default: () => "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" })
  updatedAt!: Date;

  @ManyToOne(
    () => OrganizationEntity,
    (organization: OrganizationEntity) => organization.id,
    {
      onDelete: "CASCADE",
    },
  )
  organization!: OrganizationEntity;
}
