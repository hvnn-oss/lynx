import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { OrganizationEntity } from "./organization.entity";

@Entity("organization-domain")
export class OrganizationDomainEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  domain!: string;

  @ManyToOne(() => OrganizationEntity, (organization) => organization.domains)
  organization!: OrganizationEntity;
}
