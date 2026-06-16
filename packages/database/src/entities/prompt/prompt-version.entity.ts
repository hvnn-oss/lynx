import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { PromptEntity } from "./prompt.entity";
import { WorkspaceEntity } from "../organization/workspace.entity";

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

  @ManyToOne(() => WorkspaceEntity, (workspace) => workspace, {
    onDelete: "CASCADE",
  })
  workspace!: WorkspaceEntity;

  @OneToMany(() => PromptEntity, (prompt) => prompt.version)
  prompts!: PromptEntity[];
}
