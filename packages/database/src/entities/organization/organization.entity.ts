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

  @Column({ default: false })
  forceSSO!: boolean;

  @Column({ nullable: true })
  oidcClientId?: string;

  @Column({ nullable: true })
  oidcClientSecret?: string;

  @Column({ nullable: true })
  oidcIssuer?: string;

  @Column({ nullable: true })
  samlEntryPoint?: string;

  @Column({ nullable: true })
  samlIssuer?: string;

  @Column({ type: "text", nullable: true })
  samlCert?: string;

  @OneToMany(() => OrganizationUserEntity, (user) => user.organization)
  users!: OrganizationUserEntity[];

  @OneToMany(() => OrganizationDomainEntity, (domain) => domain.organization)
  domains!: OrganizationDomainEntity[];

  @OneToMany(() => WorkspaceEntity, (workspace) => workspace.organization)
  workspaces!: WorkspaceEntity[];
}
