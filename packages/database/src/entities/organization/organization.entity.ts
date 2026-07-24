import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { WorkspaceEntity } from "./workspace.entity";
import { OrganizationUserEntity } from "./organization-user.entity";
import { OrganizationDomainEntity } from "./domain.entity";
import { UserEntity } from "./user.entity";
import { OrganizationPlanEntity } from "./organization-plan.entity";

@Entity("organization")
export class OrganizationEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string;

  @Column({ type: "uuid" })
  planId!: string;

  @ManyToOne(
    () => OrganizationPlanEntity,
    (plan: OrganizationPlanEntity) => plan.organizations,
    { eager: true, onDelete: "RESTRICT" },
  )
  @JoinColumn({ name: "planId" })
  plan!: OrganizationPlanEntity;

  @Column({ type: "uuid" })
  ownerUserId!: string;

  @Column({ type: "uuid" })
  createdByUserId!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @ManyToOne(() => UserEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "ownerUserId" })
  owner!: UserEntity;

  @ManyToOne(() => UserEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "createdByUserId" })
  createdBy!: UserEntity;

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

  @OneToMany(
    () => OrganizationUserEntity,
    (user: OrganizationUserEntity) => user.organization,
  )
  users!: OrganizationUserEntity[];

  @OneToMany(
    () => OrganizationDomainEntity,
    (domain: OrganizationDomainEntity) => domain.organization,
  )
  domains!: OrganizationDomainEntity[];

  @OneToMany(
    () => WorkspaceEntity,
    (workspace: WorkspaceEntity) => workspace.organization,
  )
  workspaces!: WorkspaceEntity[];

}
