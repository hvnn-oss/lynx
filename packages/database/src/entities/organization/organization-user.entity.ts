import { USER_PERMISSIONS, type UserPermissions } from "@repo/constants";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { OrganizationEntity } from "./organization.entity";
import { UserEntity } from "./user.entity";

@Entity("organization-user")
export class OrganizationUserEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: "varchar",
    default: USER_PERMISSIONS.MEMBER,
  })
  role!: UserPermissions;

  @Column()
  joinedAt!: Date;

  @ManyToOne(() => OrganizationEntity, (organization) => organization.users)
  organization!: OrganizationEntity;

  @ManyToOne(() => UserEntity, (user) => user.organizations)
  user!: UserEntity;
}
