import {
  ORGANIZATION_CREATION_SOURCES,
  type OrganizationCreationSource,
} from "@repo/constants";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { OrganizationEntity } from "./organization.entity";
import { UserEntity } from "./user.entity";

@Entity("organization_creation_event")
@Index("IDX_org_creation_event_user_created", ["userId", "createdAt"])
export class OrganizationCreationEventEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid", nullable: true })
  organizationId?: string | null;

  @Column({ type: "uuid", unique: true })
  requestId!: string;

  @Column({ type: "varchar", default: ORGANIZATION_CREATION_SOURCES.API })
  source!: OrganizationCreationSource;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @ManyToOne(() => UserEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: UserEntity;

  @ManyToOne(() => OrganizationEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "organizationId" })
  organization?: OrganizationEntity | null;
}
