import { Column, Entity, OneToMany, PrimaryColumn } from "typeorm";
import { WorkspaceEntity } from "../organization/workspace.entity";

@Entity("workspace_plan")
export class WorkspacePlanEntity {
  @PrimaryColumn({ type: "varchar", length: 40 })
  code!: string;

  @Column()
  name!: string;

  @Column({ type: "integer", default: 3 })
  retentionDays!: number;

  @Column({ type: "integer", nullable: true })
  monthlyEventLimit?: number;

  @Column({ type: "integer", nullable: true })
  includedLogCount?: number;

  @Column({ type: "numeric", precision: 12, scale: 6, nullable: true })
  logOverageUnitPrice?: number;

  @Column({ type: "integer", nullable: true })
  maxMembers?: number;

  @Column({ type: "jsonb", default: {} })
  features!: Record<string, unknown>;

  @Column({ default: true })
  isActive!: boolean;

  @OneToMany(
    () => WorkspaceEntity,
    (workspace: WorkspaceEntity) => workspace.planConfig,
  )
  workspaces!: WorkspaceEntity[];
}
