import {
  PRODUCT_ACCESS_CAPABILITY,
  PRODUCT_ACCESS_GRANT_STATUS,
  type ProductAccessCapability,
  type ProductAccessGrantStatus,
  type ProductAccessSubjectType,
} from "@repo/constants";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("product_access_grant")
@Index(
  "UQ_product_access_grant_subject_capability",
  ["subjectType", "subjectId", "capability"],
  { unique: true },
)
@Index("IDX_product_access_grant_lookup", [
  "subjectType",
  "subjectId",
  "status",
])
export class ProductAccessGrantEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  subjectType!: ProductAccessSubjectType;

  @Column({ type: "uuid" })
  subjectId!: string;

  @Column({ type: "varchar", default: PRODUCT_ACCESS_CAPABILITY.LYNX_CORE })
  capability!: ProductAccessCapability;

  @Column({ type: "varchar", default: PRODUCT_ACCESS_GRANT_STATUS.ACTIVE })
  status!: ProductAccessGrantStatus;

  @Column({ type: "uuid", nullable: true })
  grantedByUserId!: string | null;

  @Column({ type: "timestamptz" })
  grantedAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  expiresAt!: Date | null;

  @Column({ type: "jsonb", nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
