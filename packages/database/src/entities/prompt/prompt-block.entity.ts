import { PROMPT_TYPE, type PromptType } from "@repo/constants";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { PromptEntity } from "./prompt.entity";

@Entity("prompt-block")
export class PromptBlockEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string;

  @Column({ type: "varchar", default: PROMPT_TYPE.SYSTEM })
  type!: PromptType;

  @Column()
  content!: string;

  @ManyToOne(() => PromptEntity, (prompt) => prompt.blocks, {
    onDelete: "CASCADE",
  })
  prompt!: PromptEntity;
}
