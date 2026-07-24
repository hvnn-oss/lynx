import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { UserEntity } from "../organization/user.entity";
import { WorkspaceEntity } from "../organization/workspace.entity";
import { WorkspaceMembershipEntity } from "../workspace/workspace-membership.entity";
import { IssueEntity } from "./issue.entity";

@Entity("issue_assignee")
@Index("UQ_issue_assignee_issue_user", ["issueId", "userId"], {
  unique: true,
})
@Index("IDX_issue_assignee_workspace_user", ["workspaceId", "userId"])
export class IssueAssigneeEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "uuid" })
  issueId!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid", nullable: true })
  assignedByUserId!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  assignedAt!: Date;

  @ManyToOne(() => WorkspaceEntity, { onDelete: "CASCADE" })
  @JoinColumn({
    name: "workspaceId",
    foreignKeyConstraintName: "FK_issue_assignee_workspace",
  })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => IssueEntity, { onDelete: "CASCADE" })
  @JoinColumn({
    name: "issueId",
    foreignKeyConstraintName: "FK_issue_assignee_issue",
  })
  issue!: IssueEntity;

  @ManyToOne(() => WorkspaceMembershipEntity, { onDelete: "CASCADE" })
  @JoinColumn([
    {
      name: "workspaceId",
      referencedColumnName: "workspaceId",
      foreignKeyConstraintName: "FK_issue_assignee_membership",
    },
    {
      name: "userId",
      referencedColumnName: "userId",
      foreignKeyConstraintName: "FK_issue_assignee_membership",
    },
  ])
  membership!: WorkspaceMembershipEntity;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "assignedByUserId",
    foreignKeyConstraintName: "FK_issue_assignee_assigned_by",
  })
  assignedByUser!: UserEntity | null;
}
