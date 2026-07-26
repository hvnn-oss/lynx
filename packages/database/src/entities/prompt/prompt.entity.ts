import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { SessionEntity } from "../session/session.entity";
import { WorkspaceEntity } from "../organization/workspace.entity";
import { PromptBlockEntity } from "./prompt-block.entity";
import { PromptDeploymentEntity } from "./prompt-deployment.entity";
import { PromptExperimentEntity } from "./prompt-experiment.entity";
import { PromptVersionEntity } from "./prompt-version.entity";

@Entity("prompt")
export class PromptEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string;

  @Column({ type: "text" })
  description!: string;

  @Column()
  currentVersion!: string;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;

  @Column({ type: "uuid", nullable: true })
  workspaceId!: string | null;

  @Column({ type: "text", nullable: true })
  draftContent!: string | null;

  @Column({ type: "integer", default: 1 })
  draftRevision!: number;

  @Column({ type: "uuid", nullable: true })
  draftUpdatedByUserId!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  deletedAt!: Date | null;

  @ManyToOne(
    () => PromptVersionEntity,
    (version: PromptVersionEntity) => version.prompts,
    { nullable: true, onDelete: "SET NULL" },
  )
  version!: PromptVersionEntity | null;

  @ManyToOne(() => WorkspaceEntity, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "workspaceId" })
  workspace!: WorkspaceEntity | null;

  @OneToMany(() => PromptVersionEntity, (version) => version.prompt)
  versions!: PromptVersionEntity[];

  @OneToMany(() => PromptDeploymentEntity, (deployment) => deployment.prompt)
  deployments!: PromptDeploymentEntity[];

  @OneToMany(() => PromptExperimentEntity, (experiment) => experiment.prompt)
  experiments!: PromptExperimentEntity[];

  @OneToMany(
    () => PromptBlockEntity,
    (block: PromptBlockEntity) => block.prompt,
  )
  blocks!: PromptBlockEntity[];

  @OneToMany(
    () => SessionEntity,
    (session: SessionEntity) => session.usedPrompt,
  )
  sessions!: SessionEntity[];
}
