import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { WorkspaceEntity } from "./workspace.entity";
import { OrganizationUserEntity } from "./organization-user.entity";
import { OrganizationDomainEntity } from "./domain.entity";

@Entity("organization")
export class OrganizationEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string;

  @Column({ default: false })
  useSso!: boolean;

  @OneToMany(() => OrganizationUserEntity, (user) => user.organization)
  users!: OrganizationUserEntity[];

  @OneToMany(() => OrganizationDomainEntity, (domain) => domain.organization)
  domains!: OrganizationDomainEntity[];

  @OneToMany(() => WorkspaceEntity, (workspace) => workspace.organization)
  workspaces!: WorkspaceEntity[];
}
