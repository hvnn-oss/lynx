import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { WorkspaceEntity } from "../organization/workspace.entity";
import { PromptEntity } from "./prompt.entity";

@Entity("prompt-version")
export class PromptVersionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ default: "0.0" })
  version!: string;

  @Column()
  content!: string;

  @Column()
  createdBy!: number;

  @Column()
  createdAt!: Date;

  @ManyToOne(() => WorkspaceEntity, (workspace: WorkspaceEntity) => workspace, {
    onDelete: "CASCADE",
  })
  workspace!: WorkspaceEntity;

  @OneToMany(() => PromptEntity, (prompt: PromptEntity) => prompt.version)
  prompts!: PromptEntity[];
}
