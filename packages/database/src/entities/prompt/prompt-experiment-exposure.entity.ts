import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

/**
 * Records the exact experiment variant first used by one Run.
 *
 * Assignment keys are deliberately excluded so user identifiers never leave
 * the customer application solely for experiment analytics.
 */
@Entity("prompt_experiment_exposure")
@Index(
  "UQ_prompt_experiment_exposure_run",
  ["experimentId", "runId", "promptId"],
  { unique: true },
)
@Index("IDX_prompt_experiment_exposure_metrics", [
  "workspaceId",
  "experimentId",
  "promptVersionId",
  "exposedAt",
])
export class PromptExperimentExposureEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "uuid" })
  experimentId!: string;

  @Column({ type: "uuid" })
  promptId!: string;

  @Column({ type: "uuid" })
  promptVersionId!: string;

  @Column({ type: "uuid" })
  runId!: string;

  @Column({ type: "uuid" })
  sessionId!: string;

  @Column({ type: "uuid" })
  agentId!: string;

  @Column({ type: "varchar", length: 30 })
  environment!: string;

  @Column({ type: "smallint" })
  bucket!: number;

  @Column({ type: "varchar", length: 255 })
  runtimeConfigRevision!: string;

  @Column({ type: "timestamptz" })
  exposedAt!: Date;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
