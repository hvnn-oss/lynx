import { type EventType } from "@repo/constants";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { SessionEntity } from "../session/session.entity";
import { RunEntity } from "../run/run.entity.js";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;

  metadata?: Record<string, unknown>;
}

export interface LynxEventPayloadDto {
  input?: any;
  output?: any;
  error?: string;
  arguments?: any;
  stepId?: string;
  parentStepId?: string;
  usage?: TokenUsage;
  cost?: number;
  costSource?:
    | "PROVIDER_REPORTED"
    | "CLIENT_REPORTED"
    | "CLIENT_ESTIMATED"
    | "SERVER_ESTIMATED"
    | "UNPRICED";
  pricingVersion?: string;
  loopDetected?: boolean;
  loopCount?: number;
  repeatedLabel?: string;
  isPolluted?: boolean;
  pollutionReason?: string;
  [key: string]: any;
}

@Entity("event")
@Index("UQ_event_run_client_event", { synchronize: false })
@Index("IDX_event_run_timestamp", { synchronize: false })
@Index("IDX_event_session_timestamp", { synchronize: false })
@Index("IDX_event_type_timestamp", { synchronize: false })
@Index("IDX_event_timestamp", { synchronize: false })
@Index("IDX_event_created_at", { synchronize: false })
@Index("IDX_event_payload_span_id", { synchronize: false })
@Index("IDX_event_payload_parent_span_id", { synchronize: false })
@Index("IDX_event_prompt_version_ids", { synchronize: false })
export class EventEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({
    type: "varchar",
    length: 50,
  })
  eventType!: EventType;

  @Column({ type: "varchar", length: 255 })
  label!: string;

  @Column({ type: "varchar", length: 120, nullable: true })
  clientId?: string;

  @Column({ type: "varchar", length: 120, nullable: true })
  clientEventId?: string;

  @Column({ type: "varchar", length: 40, nullable: true })
  schemaVersion?: string;

  @Column({ type: "jsonb", nullable: true })
  payload!: LynxEventPayloadDto;

  @Column({ type: "int", nullable: true })
  latency?: number;

  @Column({ type: "numeric", precision: 20, scale: 12, nullable: true })
  cost?: number;

  @Column()
  timestamp!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => SessionEntity, (session: SessionEntity) => session.events, {
    onDelete: "CASCADE",
  })
  session!: SessionEntity;

  @ManyToOne(() => RunEntity, (run) => run.events, {
    nullable: true,
    onDelete: "CASCADE",
  })
  run?: RunEntity;
}
