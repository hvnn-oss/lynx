import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export const WORKSPACE_PLAN_VALUES = ["FREE", "PRO", "ENTERPRISE"] as const;
export type WorkspacePlanValue = (typeof WORKSPACE_PLAN_VALUES)[number];

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
  @IsIn(WORKSPACE_PLAN_VALUES)
  plan?: WorkspacePlanValue;
}

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsIn(WORKSPACE_PLAN_VALUES)
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
}

export interface WorkspaceDetailDto extends WorkspaceSummaryDto {
  apiKey?: string;
}

export interface WorkspaceApiKeyResponseDto {
  workspaceId: string;
  apiKey: string;
}
