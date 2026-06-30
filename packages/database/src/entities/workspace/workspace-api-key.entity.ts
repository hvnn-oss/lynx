import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { WorkspaceEntity } from "../organization/workspace.entity";

@Entity("workspace_api_key")
@Index("IDX_workspace_api_key_hash", ["keyHash"], { unique: true })
@Index("IDX_workspace_api_key_workspace_active", ["workspace", "revokedAt"])
export class WorkspaceApiKeyEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 24 })
  prefix!: string;

  @Column({ type: "varchar", length: 64 })
  keyHash!: string;

  @Column({ type: "varchar", length: 120, nullable: true })
  name?: string;

  @Column({ type: "uuid", nullable: true })
  createdByUserId?: string;

  @Column({ type: "varchar", length: 120, nullable: true })
  createdByName?: string;

  @Column({ type: "text", array: true, default: () => "ARRAY['events:write']" })
  scopes!: string[];

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
  workspace!: WorkspaceEntity;
}
