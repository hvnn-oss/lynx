import { USER_PERMISSIONS, type UserPermissions } from "@repo/constants";
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { OrganizationEntity } from "./organization.entity";
import { UserEntity } from "./user.entity";

@Entity("organization-user")
@Index("UQ_organization_user_membership", ["organization", "user"], {
  unique: true,
})
export class OrganizationUserEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", default: USER_PERMISSIONS.MEMBER })
  role!: UserPermissions;

  @Column()
  joinedAt!: Date;

  @ManyToOne(
    () => OrganizationEntity,
    (organization: OrganizationEntity) => organization.users,
    { onDelete: "CASCADE" },
  )
  organization!: OrganizationEntity;

  @ManyToOne(() => UserEntity, (user: UserEntity) => user.organizations, {
    onDelete: "CASCADE",
  })
  user!: UserEntity;
}
