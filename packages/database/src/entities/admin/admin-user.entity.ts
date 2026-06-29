import { ADMIN_ROLES, type AdminRole } from "@repo/constants";
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { UserEntity } from "../organization/user.entity";

@Entity("admin_user")
export class AdminUserEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", default: ADMIN_ROLES.ADMIN })
  role!: AdminRole;

  @Column({ default: true })
  isActive!: boolean;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: "CASCADE" })
  user!: UserEntity;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
