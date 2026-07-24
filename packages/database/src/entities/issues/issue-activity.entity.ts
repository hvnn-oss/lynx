import {
  ISSUE_ACTOR_TYPE,
  type IssueActivityType,
  type IssueActorType,
} from "@repo/constants";
import {
  Check,
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
import { IssueEntity } from "./issue.entity";

@Entity("issue_activity")
@Check(
  "CHK_issue_activity_type",
  `"type" IN ('CREATED', 'REOPENED', 'STATUS_CHANGED', 'SEVERITY_CHANGED', 'ASSIGNED', 'UNASSIGNED', 'LABEL_ADDED', 'LABEL_REMOVED', 'TAG_ADDED', 'COMMENTED')`,
)
@Check(
  "CHK_issue_activity_actor_type",
  `"actorType" IN ('USER', 'SDK', 'SYSTEM')`,
)
@Index("IDX_issue_activity_issue_created", ["issueId", "createdAt", "id"])
export class IssueActivityEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "uuid" })
  issueId!: string;

  @Column({ type: "varchar", length: 30 })
  type!: IssueActivityType;

  @Column({
    type: "varchar",
    length: 20,
    default: ISSUE_ACTOR_TYPE.SYSTEM,
  })
  actorType!: IssueActorType;

  @Column({ type: "uuid", nullable: true })
  actorUserId!: string | null;

  @Column({ type: "varchar", length: 120 })
  actorName!: string;

  @Column({ type: "text", nullable: true })
  body!: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @ManyToOne(() => WorkspaceEntity, { onDelete: "CASCADE" })
  @JoinColumn({
    name: "workspaceId",
    foreignKeyConstraintName: "FK_issue_activity_workspace",
  })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => IssueEntity, { onDelete: "CASCADE" })
  @JoinColumn({
    name: "issueId",
    foreignKeyConstraintName: "FK_issue_activity_issue",
  })
  issue!: IssueEntity;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "actorUserId",
    foreignKeyConstraintName: "FK_issue_activity_actor_user",
  })
  actorUser!: UserEntity | null;
}
