import {
  WORKSPACE_API_KEY_KINDS,
  type ApiKeyScope,
  type WorkspaceApiKeyKind,
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
import { WorkspaceEntity } from "../organization/workspace.entity";
import { UserEntity } from "../organization/user.entity";

@Entity("workspace_api_key")
@Check(
  "CHK_workspace_api_key_kind",
  `"kind" IN ('INGEST', 'SDK', 'AUTOMATION')`,
)
@Index("IDX_workspace_api_key_hash", ["keyHash"], { unique: true })
@Index("IDX_workspace_api_key_workspace_active", ["workspaceId", "revokedAt"])
export class WorkspaceApiKeyEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "varchar", length: 24 })
  prefix!: string;

  @Column({ type: "varchar", length: 64 })
  keyHash!: string;

  @Column({ type: "varchar", length: 120 })
  name!: string;

  @Column({
    type: "varchar",
    length: 20,
    default: WORKSPACE_API_KEY_KINDS.INGEST,
  })
  kind!: WorkspaceApiKeyKind;

  @Column({ type: "uuid", nullable: true })
  createdByUserId?: string;

  @Column({ type: "varchar", length: 120, nullable: true })
  createdByName?: string;

  @Column({ type: "text", array: true, default: () => "ARRAY['events:write']" })
  scopes!: ApiKeyScope[];

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: "timestamp", nullable: true })
  lastUsedAt?: Date;

  @Column({ type: "timestamp", nullable: true })
  revokedAt?: Date;

  @Column({ type: "timestamp", nullable: true })
  expiresAt?: Date;

  @ManyToOne(
    () => WorkspaceEntity,
    (workspace: WorkspaceEntity) => workspace.apiKeys,
    {
      onDelete: "CASCADE",
    },
  )
  @JoinColumn({ name: "workspaceId" })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "createdByUserId",
    foreignKeyConstraintName: "FK_workspace_api_key_created_by",
  })
  createdBy?: UserEntity;
}
