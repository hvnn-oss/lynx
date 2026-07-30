import {
  ACCESS_INVITATION_STATUS,
  ACCESS_INVITATION_TARGET_TYPE,
  type AccessInvitationStatus,
  type AccessInvitationTargetType,
} from "@repo/constants";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("access_invitation")
@Index("IDX_access_invitation_email_status", ["email", "status"])
@Index("IDX_access_invitation_created", ["createdAt", "id"])
export class AccessInvitationEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 320 })
  email!: string;

  @Column({ type: "char", length: 64, unique: true })
  tokenHash!: string;

  @Column({
    type: "varchar",
    default: ACCESS_INVITATION_TARGET_TYPE.PRODUCT,
  })
  targetType!: AccessInvitationTargetType;

  @Column({ type: "uuid", nullable: true })
  targetId!: string | null;

  @Column({ type: "varchar", nullable: true })
  role!: string | null;

  @Column({ type: "uuid", nullable: true })
  organizationPlanId!: string | null;

  @Column({ type: "varchar", default: ACCESS_INVITATION_STATUS.PENDING })
  status!: AccessInvitationStatus;

  @Column({ type: "uuid" })
  invitedByUserId!: string;

  @Column({ type: "uuid", nullable: true })
  acceptedByUserId!: string | null;

  @Column({ type: "timestamptz" })
  expiresAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  acceptedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
