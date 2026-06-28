import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Request } from 'express';
import {
  AddOrganizationMemberDto,
  CreateOrganizationDto,
  OrganizationIdParamDto,
  OrganizationMemberParamDto,
  UpdateOrganizationDto,
  UpdateOrganizationMemberRoleDto,
  UpdateOrganizationSsoSettingsDto,
} from '@repo/dto';
import type {
  OrganizationDetailDto,
  OrganizationMemberDto,
  OrganizationSsoSettingsDto,
  OrganizationSummaryDto,
  SuccessResponseDto,
} from '@repo/dto';

type AuthenticatedRequest = Request & { user?: { sub: string } };

@Controller('organization')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Get()
  async listOrganizations(
    @Req() req: AuthenticatedRequest,
  ): Promise<OrganizationSummaryDto[]> {
    return await this.orgService.listOrganizations(req.user!.sub);
  }

  @Post()
  async createOrganization(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateOrganizationDto,
  ): Promise<OrganizationDetailDto> {
    return await this.orgService.createOrganization(req.user!.sub, body);
  }

  @Get(':organizationId')
  async getOrganization(
    @Param() params: OrganizationIdParamDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<OrganizationDetailDto> {
    return await this.orgService.getOrganization(
      params.organizationId,
      req.user!.sub,
    );
  }

  @Patch(':organizationId')
  async updateOrganization(
    @Param() params: OrganizationIdParamDto,
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateOrganizationDto,
  ): Promise<OrganizationDetailDto> {
    return await this.orgService.updateOrganization(
      params.organizationId,
      req.user!.sub,
      body,
    );
  }

  @Delete(':organizationId')
  async deleteOrganization(
    @Param() params: OrganizationIdParamDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SuccessResponseDto> {
    return await this.orgService.deleteOrganization(
      params.organizationId,
      req.user!.sub,
    );
  }

  @Get(':organizationId/member')
  async listMembers(
    @Param() params: OrganizationIdParamDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<OrganizationMemberDto[]> {
    return await this.orgService.listMembers(
      params.organizationId,
      req.user!.sub,
    );
  }

  @Post(':organizationId/member')
  async addMember(
    @Param() params: OrganizationIdParamDto,
    @Req() req: AuthenticatedRequest,
    @Body() body: AddOrganizationMemberDto,
  ): Promise<OrganizationMemberDto> {
    return await this.orgService.addMember(
      params.organizationId,
      req.user!.sub,
      body,
    );
  }

  @Patch(':organizationId/member/:userId')
  async updateMemberRole(
    @Param() params: OrganizationMemberParamDto,
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateOrganizationMemberRoleDto,
  ): Promise<OrganizationMemberDto> {
    return await this.orgService.updateMemberRole(
      params.organizationId,
      params.userId,
      req.user!.sub,
      body,
    );
  }

  @Delete(':organizationId/member/:userId')
  async removeMember(
    @Param() params: OrganizationMemberParamDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SuccessResponseDto> {
    return await this.orgService.removeMember(
      params.organizationId,
      params.userId,
      req.user!.sub,
    );
  }

  @Get(':organizationId/sso')
  async getSsoSettings(
    @Param() params: OrganizationIdParamDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<OrganizationSsoSettingsDto> {
    return await this.orgService.getSsoSettings(
      params.organizationId,
      req.user!.sub,
    );
  }

  @Post(':organizationId/sso')
  @Put(':organizationId/sso')
  async updateSsoSettings(
    @Param() params: OrganizationIdParamDto,
    @Req() req: AuthenticatedRequest,
    @Body() settings: UpdateOrganizationSsoSettingsDto,
  ): Promise<SuccessResponseDto> {
    return await this.orgService.updateSsoSettings(
      params.organizationId,
      req.user!.sub,
      settings,
    );
  }
}
