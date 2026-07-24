import {
  ISSUE_RECORD_STATUS,
  type IssueRecordStatus,
} from "@repo/constants";
import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";
import { IssueRecordEntity } from "./issue-record.entity";

@Entity("issue_record_processing")
@Check(
  "CHK_issue_record_processing_status",
  `"status" IN ('RECEIVED', 'EVALUATING', 'DECIDED', 'FAILED')`,
)
@Index("IDX_issue_record_processing_status_next", [
  "status",
  "nextEvaluationAt",
  "updatedAt",
])
export class IssueRecordProcessingEntity {
  @PrimaryColumn({ type: "uuid" })
  recordId!: string;

  @Column({
    type: "varchar",
    length: 20,
    default: ISSUE_RECORD_STATUS.RECEIVED,
  })
  status!: IssueRecordStatus;

  @Column({ type: "integer", default: 0 })
  attemptCount!: number;

  @Column({ type: "varchar", length: 80, nullable: true })
  lastErrorCode!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  evaluationStartedAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  decidedAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  nextEvaluationAt!: Date | null;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @OneToOne(() => IssueRecordEntity, { onDelete: "CASCADE" })
  @JoinColumn({
    name: "recordId",
    foreignKeyConstraintName: "FK_issue_record_processing_record",
  })
  record!: IssueRecordEntity;
}
