import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { PromptBlockEntity } from "./prompt-block.entity";
import { PromptVersionEntity } from "./prompt-version.entity";
import { SessionEntity } from "../session/session.entity";

@Entity("prompt")
export class PromptEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string;

  @Column()
  description!: string;

  @Column()
  currentVersion!: string;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;

  @ManyToOne(() => PromptVersionEntity, (version: PromptVersionEntity) => version.prompts, {
    onDelete: "CASCADE",
  })
  version!: PromptVersionEntity;

  @OneToMany(() => PromptBlockEntity, (block: PromptBlockEntity) => block.prompt)
  blocks!: PromptBlockEntity[];

  @OneToMany(() => SessionEntity, (session: SessionEntity) => session.usedPrompt)
  sessions!: SessionEntity[];
}
