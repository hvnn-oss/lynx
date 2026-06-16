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

  @ManyToOne(() => PromptVersionEntity, (version) => version.prompts, {
    onDelete: "CASCADE",
  })
  version!: PromptVersionEntity;

  @OneToMany(() => PromptBlockEntity, (block) => block.prompt)
  blocks!: PromptBlockEntity[];

  @OneToMany(() => SessionEntity, (session) => session.usedPrompt)
  sessions!: SessionEntity[];
}
