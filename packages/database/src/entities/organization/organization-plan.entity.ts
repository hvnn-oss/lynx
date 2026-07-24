import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { OrganizationEntity } from "./organization.entity";

/** Billing and usage limits inherited by every workspace in an organization. */
@Entity("organization_plan")
export class OrganizationPlanEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 40, unique: true })
  code!: string;

  @Column()
  name!: string;

  @Column({ type: "integer", nullable: true })
  maxWorkspaces!: number | null;

  @Column({ type: "integer", nullable: true })
  maxMembers!: number | null;

  @Column({ type: "integer", default: 3 })
  retentionDays!: number;

  @Column({ type: "integer", nullable: true })
  monthlyEventLimit!: number | null;

  @Column({ type: "integer", nullable: true })
  includedLogCount!: number | null;

  @Column({ type: "numeric", precision: 12, scale: 6, nullable: true })
  logOverageUnitPrice!: number | null;

  @Column({ type: "jsonb", default: {} })
  features!: Record<string, unknown>;

  @Column({ default: true })
  isActive!: boolean;

  @OneToMany(
    () => OrganizationEntity,
    (organization: OrganizationEntity) => organization.plan,
  )
  organizations!: OrganizationEntity[];
}
