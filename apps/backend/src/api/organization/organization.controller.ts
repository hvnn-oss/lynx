import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';
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

@Controller('organization')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Get()
  async listOrganizations(
    @CurrentUserId() userId: string,
  ): Promise<OrganizationSummaryDto[]> {
    return await this.orgService.listOrganizations(userId);
  }

  @Post()
  async createOrganization(
    @CurrentUserId() userId: string,
    @Body() body: CreateOrganizationDto,
  ): Promise<OrganizationDetailDto> {
    return await this.orgService.createOrganization(userId, body);
  }

  @Get(':organizationId')
  async getOrganization(
    @Param() params: OrganizationIdParamDto,
    @CurrentUserId() userId: string,
  ): Promise<OrganizationDetailDto> {
    return await this.orgService.getOrganization(params.organizationId, userId);
  }

  @Patch(':organizationId')
  async updateOrganization(
    @Param() params: OrganizationIdParamDto,
    @CurrentUserId() userId: string,
    @Body() body: UpdateOrganizationDto,
  ): Promise<OrganizationDetailDto> {
    return await this.orgService.updateOrganization(
      params.organizationId,
      userId,
      body,
    );
  }

  @Delete(':organizationId')
  async deleteOrganization(
    @Param() params: OrganizationIdParamDto,
    @CurrentUserId() userId: string,
  ): Promise<SuccessResponseDto> {
    return await this.orgService.deleteOrganization(
      params.organizationId,
      userId,
    );
  }

  @Get(':organizationId/member')
  async listMembers(
    @Param() params: OrganizationIdParamDto,
    @CurrentUserId() userId: string,
  ): Promise<OrganizationMemberDto[]> {
    return await this.orgService.listMembers(params.organizationId, userId);
  }

  @Post(':organizationId/member')
  async addMember(
    @Param() params: OrganizationIdParamDto,
    @CurrentUserId() userId: string,
    @Body() body: AddOrganizationMemberDto,
  ): Promise<OrganizationMemberDto> {
    return await this.orgService.addMember(params.organizationId, userId, body);
  }

  @Patch(':organizationId/member/:userId')
  async updateMemberRole(
    @Param() params: OrganizationMemberParamDto,
    @CurrentUserId() userId: string,
    @Body() body: UpdateOrganizationMemberRoleDto,
  ): Promise<OrganizationMemberDto> {
    return await this.orgService.updateMemberRole(
      params.organizationId,
      params.userId,
      userId,
      body,
    );
  }

  @Delete(':organizationId/member/:userId')
  async removeMember(
    @Param() params: OrganizationMemberParamDto,
    @CurrentUserId() userId: string,
  ): Promise<SuccessResponseDto> {
    return await this.orgService.removeMember(
      params.organizationId,
      params.userId,
      userId,
    );
  }

  @Get(':organizationId/sso')
  async getSsoSettings(
    @Param() params: OrganizationIdParamDto,
    @CurrentUserId() userId: string,
  ): Promise<OrganizationSsoSettingsDto> {
    return await this.orgService.getSsoSettings(params.organizationId, userId);
  }

  @Post(':organizationId/sso')
  @Put(':organizationId/sso')
  async updateSsoSettings(
    @Param() params: OrganizationIdParamDto,
    @CurrentUserId() userId: string,
    @Body() settings: UpdateOrganizationSsoSettingsDto,
  ): Promise<SuccessResponseDto> {
    return await this.orgService.updateSsoSettings(
      params.organizationId,
      userId,
      settings,
    );
  }
}
