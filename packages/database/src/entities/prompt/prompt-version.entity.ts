import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { WorkspaceEntity } from "../organization/workspace.entity";
import { PromptEntity } from "./prompt.entity";

@Entity("prompt-version")
@Index("UQ_prompt_version_label", { synchronize: false })
@Index("UQ_prompt_version_draft_revision", { synchronize: false })
@Index("IDX_prompt_version_prompt_created", ["promptId", "createdAt", "id"])
export class PromptVersionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ default: "0.0" })
  version!: string;

  @Column({ type: "text" })
  content!: string;

  @Column({ type: "integer", nullable: true })
  createdBy!: number | null;

  @Column()
  createdAt!: Date;

  @Column({ type: "uuid", nullable: true })
  promptId!: string | null;

  @Column({ type: "char", length: 64, nullable: true })
  contentHash!: string | null;

  @Column({ type: "uuid", nullable: true })
  baseVersionId!: string | null;

  @Column({ type: "text", nullable: true })
  changeReason!: string | null;

  @Column({ type: "uuid", nullable: true })
  createdByUserId!: string | null;

  @Column({ type: "integer", nullable: true })
  draftRevision!: number | null;

  @ManyToOne(() => WorkspaceEntity, (workspace: WorkspaceEntity) => workspace, {
    onDelete: "CASCADE",
  })
  workspace!: WorkspaceEntity;

  @OneToMany(() => PromptEntity, (prompt: PromptEntity) => prompt.version)
  prompts!: PromptEntity[];

  @ManyToOne(() => PromptEntity, (prompt) => prompt.versions, {
    nullable: true,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "promptId" })
  prompt!: PromptEntity | null;

  @ManyToOne(() => PromptVersionEntity, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "baseVersionId" })
  baseVersion!: PromptVersionEntity | null;
}
