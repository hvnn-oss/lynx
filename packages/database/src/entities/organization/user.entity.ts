import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { OrganizationEntity } from "./organization.entity";
import { UserAccountEntity } from "../auth/user-account.entity";
import { OrganizationUserEntity } from "./organization-user.entity";

@Entity("user")
export class UserEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  name!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => UserAccountEntity, (account) => account.user)
  accounts!: UserAccountEntity[];

  @OneToMany(() => OrganizationUserEntity, (organization) => organization.user)
  organizations!: OrganizationEntity[];
}
