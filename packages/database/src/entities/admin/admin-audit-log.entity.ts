import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("admin_audit_log")
@Index("IDX_admin_audit_log_actor_created", { synchronize: false })
@Index("IDX_admin_audit_log_target", { synchronize: false })
@Index("IDX_admin_audit_log_created", { synchronize: false })
@Index("IDX_admin_audit_log_action_created", { synchronize: false })
@Index("IDX_admin_audit_log_request", { synchronize: false })
export class AdminAuditLogEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  actorUserId!: string;

  @Column()
  action!: string;

  @Column()
  targetType!: string;

  @Column()
  targetId!: string;

  @Column({ type: "uuid", nullable: true })
  workspaceId!: string | null;

  @Column({ type: "uuid", nullable: true })
  organizationId!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  requestId!: string | null;

  @Column({ type: "jsonb", nullable: true })
  before?: Record<string, unknown>;

  @Column({ type: "jsonb", nullable: true })
  after?: Record<string, unknown>;

  @Column({ type: "jsonb", nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;
}
