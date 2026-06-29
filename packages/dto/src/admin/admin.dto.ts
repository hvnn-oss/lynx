import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export const ADMIN_ROLE_VALUES = ["ADMIN", "SUPER_ADMIN"] as const;
export type AdminRoleValue = (typeof ADMIN_ROLE_VALUES)[number];

export class AdminPlanCodeParamDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(40)
  code!: string;
}

export class AdminUserIdParamDto {
  @IsNotEmpty()
  @IsUUID()
  userId!: string;
}

export class AdminOrganizationIdParamDto {
  @IsNotEmpty()
  @IsUUID()
  organizationId!: string;
}

export class AdminWorkspaceIdParamDto {
  @IsNotEmpty()
  @IsUUID()
  workspaceId!: string;
}

export class AdminUpdatePlanDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsInt()
  @Min(1)
  retentionDays!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  monthlyEventLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  includedLogCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  logOverageUnitPrice?: number;

  @IsObject()
  features!: Record<string, unknown>;

  @IsBoolean()
  isActive!: boolean;
}

export class AdminCreatePlanDto extends AdminUpdatePlanDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  code!: string;
}

export class AdminUpdateUserDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}

export class AdminUpdateOrganizationDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsBoolean()
  useSso!: boolean;

  @IsBoolean()
  forceSSO!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  oidcIssuer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  oidcClientId?: string;
}

export class AdminUpdateWorkspaceDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsNotEmpty()
  @IsUUID()
  organizationId!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(40)
  plan!: string;
}

export class AdminOrganizationSearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export interface AdminMeDto {
  userId: string;
  email: string;
  name: string;
  role: AdminRoleValue;
}

export interface AdminPlanDto {
  code: string;
  name: string;
  retentionDays: number;
  monthlyEventLimit?: number;
  includedLogCount?: number;
  logOverageUnitPrice?: number;
  features: Record<string, unknown>;
  isActive: boolean;
}

export interface AdminUserDto {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface AdminOrganizationDto {
  id: string;
  name: string;
  useSso: boolean;
  forceSSO: boolean;
  oidcIssuer?: string;
  oidcClientId?: string;
  memberCount: number;
  workspaceCount: number;
}

export interface AdminWorkspaceDto {
  id: string;
  name: string;
  plan: string;
  organization: {
    id: string;
    name: string;
  };
  planConfig?: AdminPlanDto;
}

export interface AdminOrganizationSearchItemDto extends AdminOrganizationDto {
  workspaces: AdminWorkspaceDto[];
}

export interface AdminOrganizationSearchResponseDto {
  query: string;
  limit: number;
  organizations: AdminOrganizationSearchItemDto[];
}

export interface AdminDashboardDto {
  me: AdminMeDto;
  counts: {
    plans: number;
    users: number;
    organizations: number;
    workspaces: number;
  };
  plans: AdminPlanDto[];
  users: AdminUserDto[];
  organizations: AdminOrganizationDto[];
  workspaces: AdminWorkspaceDto[];
}
