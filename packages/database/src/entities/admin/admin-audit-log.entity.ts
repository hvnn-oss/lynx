import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("admin_audit_log")
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
