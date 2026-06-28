import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export const ORGANIZATION_MEMBER_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
export type OrganizationMemberRole = (typeof ORGANIZATION_MEMBER_ROLES)[number];

export class OrganizationIdParamDto {
  @IsNotEmpty()
  @IsUUID()
  organizationId!: string;
}

export class OrganizationMemberParamDto extends OrganizationIdParamDto {
  @IsNotEmpty()
  @IsUUID()
  userId!: string;
}

export class CreateOrganizationDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;
}

export class AddOrganizationMemberDto {
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsIn(ORGANIZATION_MEMBER_ROLES)
  role?: OrganizationMemberRole;
}

export class UpdateOrganizationMemberRoleDto {
  @IsNotEmpty()
  @IsIn(ORGANIZATION_MEMBER_ROLES)
  role!: OrganizationMemberRole;
}

export class UpdateOrganizationSsoSettingsDto {
  @IsOptional()
  @IsBoolean()
  useSso?: boolean;

  @IsOptional()
  @IsBoolean()
  forceSSO?: boolean;

  @IsOptional()
  @IsString()
  oidcClientId?: string;

  @IsOptional()
  @IsString()
  oidcClientSecret?: string;

  @IsOptional()
  @IsString()
  oidcIssuer?: string;

  @IsOptional()
  @IsString()
  samlEntryPoint?: string;

  @IsOptional()
  @IsString()
  samlIssuer?: string;

  @IsOptional()
  @IsString()
  samlCert?: string;
}

export interface OrganizationSummaryDto {
  id: string;
  name: string;
  role: OrganizationMemberRole;
  workspaceCount: number;
}

export interface OrganizationMemberDto {
  userId: string;
  email: string;
  name: string;
  role: OrganizationMemberRole;
  joinedAt: string;
}

export interface OrganizationDetailDto {
  id: string;
  name: string;
  role: OrganizationMemberRole;
  members: OrganizationMemberDto[];
  workspaces: Array<{
    id: string;
    name: string;
    plan: string;
  }>;
}

export interface OrganizationSsoSettingsDto {
  useSso: boolean;
  forceSSO: boolean;
  oidcClientId?: string;
  oidcClientSecret?: string;
  oidcIssuer?: string;
  samlEntryPoint?: string;
  samlIssuer?: string;
  samlCert?: string;
}

export interface SuccessResponseDto {
  success: boolean;
}
