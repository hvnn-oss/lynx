import { type EventType } from "@repo/constants";
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { SessionEntity } from "../session/session.entity";

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
  loopDetected?: boolean;
  loopCount?: number;
  repeatedLabel?: string;
  isPolluted?: boolean;
  pollutionReason?: string;
  [key: string]: any;
}

@Entity("event")
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

  @Column({ type: "numeric", precision: 10, scale: 6, nullable: true })
  cost?: number;

  @Column()
  timestamp!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => SessionEntity, (session: SessionEntity) => session.events, {
    onDelete: "CASCADE",
  })
  session!: SessionEntity;
}
