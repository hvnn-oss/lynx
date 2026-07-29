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

  @Column({ type: "jsonb", nullable: true })
  before?: Record<string, unknown>;

  @Column({ type: "jsonb", nullable: true })
  after?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;
}
