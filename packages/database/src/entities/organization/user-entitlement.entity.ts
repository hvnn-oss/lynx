import {
  DEFAULT_USER_ENTITLEMENTS,
  USER_ENTITLEMENT_TIERS,
  type UserEntitlementTier,
} from "@repo/constants";
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";
import { UserEntity } from "./user.entity";

@Entity("user_entitlement")
export class UserEntitlementEntity {
  @PrimaryColumn({ type: "uuid" })
  userId!: string;

  @Column({ type: "varchar", default: USER_ENTITLEMENT_TIERS.FREE })
  tier!: UserEntitlementTier;

  @Column({ type: "integer", nullable: true, default: 1 })
  maxOwnedOrganizations!: number | null;

  @Column({ type: "integer", default: 3 })
  dailyOrganizationCreateLimit!: number;

  @Column({ type: "varchar", default: "DEFAULT" })
  source!: string;

  @Column({ type: "timestamptz", nullable: true })
  expiresAt?: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @OneToOne(() => UserEntity, (user: UserEntity) => user.entitlement, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "userId" })
  user!: UserEntity;

  static createFree(user: UserEntity): UserEntitlementEntity {
    const entitlement = new UserEntitlementEntity();
    entitlement.userId = user.id;
    entitlement.user = user;
    entitlement.tier = USER_ENTITLEMENT_TIERS.FREE;
    entitlement.maxOwnedOrganizations =
      DEFAULT_USER_ENTITLEMENTS.FREE.maxOwnedOrganizations;
    entitlement.dailyOrganizationCreateLimit =
      DEFAULT_USER_ENTITLEMENTS.FREE.dailyOrganizationCreateLimit;
    entitlement.source = "DEFAULT";
    return entitlement;
  }
}
