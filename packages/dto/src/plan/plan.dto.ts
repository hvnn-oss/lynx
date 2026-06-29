import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class PlanCodeParamDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(40)
  code!: string;
}

export interface PlanSummaryDto {
  code: string;
  name: string;
  retentionDays: number;
  monthlyEventLimit?: number;
  includedLogCount?: number;
  logOverageUnitPrice?: number;
  features: Record<string, unknown>;
  isActive: boolean;
}

export type PlanDetailDto = PlanSummaryDto;
