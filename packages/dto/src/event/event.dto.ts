import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";
import type { LynxEventDto, LynxEventType } from "@repo/sdk-types";

export * from "@repo/sdk-types";

export const LYNX_EVENT_TYPES = [
  "USER_INPUT",
  "AGENT_DECISION",
  "LLM_CALL",
  "LLM_REASONING",
  "TOOL_CALL",
  "TOOL_RESULT",
  "CALL_TOOLS",
  "MEMORY_ACCESS",
  "CONTEXT_RETRIEVAL",
  "POLICY_EVALUATION",
  "POLICY_VIOLATION",
  "GUARDRAIL_ACTIVATED",
  "SESSION_OUTCOME",
  "LOOP_DETECTED",
  "ERROR",
  "CONTEXT_ALERT",
] as const satisfies readonly LynxEventType[];

export class IngestEventDto implements LynxEventDto {
  @IsOptional()
  @IsString()
  eventId?: string;

  @IsNotEmpty()
  @IsString()
  clientId!: string;

  @IsNotEmpty()
  @IsString()
  runId!: string;

  @IsNotEmpty()
  @IsString()
  agentName!: string;

  @IsNotEmpty()
  @IsIn(LYNX_EVENT_TYPES)
  eventType!: LynxEventType;

  @IsNotEmpty()
  @IsString()
  label!: string;

  @IsNotEmpty()
  @IsObject()
  payload!: Record<string, unknown>;

  @IsNotEmpty()
  @IsNumber()
  timestamp!: number;

  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  schemaVersion?: string;
}
