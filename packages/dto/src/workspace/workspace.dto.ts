import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export type WorkspacePlanValue = string;

export class WorkspaceIdParamDto {
  @IsNotEmpty()
  @IsUUID()
  workspaceId!: string;
}

export class CreateWorkspaceDto {
  @IsNotEmpty()
  @IsUUID()
  organizationId!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  plan?: WorkspacePlanValue;
}

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  plan?: WorkspacePlanValue;
}

export interface WorkspaceSummaryDto {
  id: string;
  name: string;
  plan: WorkspacePlanValue;
  organization: {
    id: string;
    name: string;
  };
  planConfig?: WorkspacePlanConfigDto;
}

export interface WorkspaceDetailDto extends WorkspaceSummaryDto {
  apiKey?: string;
}

export interface WorkspacePlanConfigDto {
  code: string;
  name: string;
  retentionDays: number;
  monthlyEventLimit?: number;
  includedLogCount?: number;
  logOverageUnitPrice?: number;
  features: Record<string, unknown>;
  isActive: boolean;
}

export interface WorkspaceApiKeyResponseDto {
  workspaceId: string;
  apiKey: string;
}
