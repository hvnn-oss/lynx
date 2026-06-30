import {
  IsNotEmpty,
  IsIn,
  IsArray,
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

export class WorkspaceApiKeyIdParamDto extends WorkspaceIdParamDto {
  @IsNotEmpty()
  @IsUUID()
  apiKeyId!: string;
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
}

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;
}

export type WorkspaceApiKeyPermission = "ALL" | "RESTRICTED" | "READ_ONLY";

export class CreateWorkspaceApiKeyDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(["ALL", "RESTRICTED", "READ_ONLY"])
  permission?: WorkspaceApiKeyPermission;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];
}

export class UpdateWorkspaceApiKeyDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(["ALL", "RESTRICTED", "READ_ONLY"])
  permission?: WorkspaceApiKeyPermission;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];
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

export interface WorkspaceApiKeyDto {
  id: string;
  trackingId: string;
  name: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  prefix: string;
  secretPreview: string;
  scopes: string[];
  permission: WorkspaceApiKeyPermission;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
  expiresAt?: string;
  createdByName?: string;
  monthlySpend: number;
}

export interface CreatedWorkspaceApiKeyDto {
  workspaceId: string;
  apiKey: string;
  key: WorkspaceApiKeyDto;
}
