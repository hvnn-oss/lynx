import {
  WORKSPACE_PERMISSIONS,
  type WorkspacePermissions,
} from "@repo/constants";
import {
  Column,
  Check,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { UserEntity } from "../organization/user.entity";
import { WorkspaceEntity } from "../organization/workspace.entity";

@Entity("workspace_membership")
@Check("CHK_workspace_membership_role", `"role" IN ('ADMIN', 'MEMBER', 'VIEWER')`)
@Index("UQ_workspace_membership_workspace_user", ["workspaceId", "userId"], {
  unique: true,
})
export class WorkspaceMembershipEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({
    type: "varchar",
    length: 20,
    default: WORKSPACE_PERMISSIONS.MEMBER,
  })
  role!: WorkspacePermissions;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @Column({ type: "uuid", nullable: true })
  createdByUserId?: string;

  @ManyToOne(() => WorkspaceEntity, (workspace) => workspace.memberships, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "workspaceId",
    foreignKeyConstraintName: "FK_workspace_membership_workspace",
  })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => UserEntity, (user) => user.workspaceMemberships, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "userId",
    foreignKeyConstraintName: "FK_workspace_membership_user",
  })
  user!: UserEntity;
}
