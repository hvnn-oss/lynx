import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { UserAccountEntity } from "../auth/user-account.entity";
import { WorkspaceMembershipEntity } from "../workspace/workspace-membership.entity";
import { OrganizationUserEntity } from "./organization-user.entity";
import { UserEntitlementEntity } from "./user-entitlement.entity";

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

  @OneToMany(() => UserAccountEntity, (account: UserAccountEntity) => account.user)
  accounts!: UserAccountEntity[];

  @OneToMany(
    () => OrganizationUserEntity,
    (organization: OrganizationUserEntity) => organization.user,
  )
  organizations!: OrganizationUserEntity[];

  @OneToMany(
    () => WorkspaceMembershipEntity,
    (membership: WorkspaceMembershipEntity) => membership.user,
  )
  workspaceMemberships!: WorkspaceMembershipEntity[];

  @OneToOne(
    () => UserEntitlementEntity,
    (entitlement: UserEntitlementEntity) => entitlement.user,
  )
  entitlement?: UserEntitlementEntity;
}
