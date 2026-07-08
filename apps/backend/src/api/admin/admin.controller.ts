import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AdminUserEntity } from '@repo/database';
import {
  AdminCreatePlanDto,
  AdminOrganizationIdParamDto,
  AdminOrganizationSearchQueryDto,
  AdminPlanCodeParamDto,
  AdminUpdateOrganizationDto,
  AdminUpdatePlanDto,
  AdminUpdateUserDto,
  AdminUpdateWorkspaceDto,
  AdminUserIdParamDto,
  AdminWorkspaceIdParamDto,
} from '@repo/dto';
import type {
  AdminDashboardDto,
  AdminMeDto,
  AdminOrganizationDto,
  AdminOrganizationSearchResponseDto,
  AdminPlanDto,
  AdminUserDto,
  AdminWorkspaceDto,
} from '@repo/dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import {
  CurrentAdminUser,
  CurrentUserId,
} from '../../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('me')
  async getMe(@CurrentUserId() userId: string): Promise<AdminMeDto> {
    return await this.adminService.getMe(userId);
  }

  @Get('dashboard')
  async getDashboard(
    @CurrentUserId() userId: string,
  ): Promise<AdminDashboardDto> {
    return await this.adminService.getDashboard(userId);
  }

  @Get('organizations/search')
  async searchOrganizations(
    @CurrentUserId() userId: string,
    @Query() query: AdminOrganizationSearchQueryDto,
  ): Promise<AdminOrganizationSearchResponseDto> {
    return await this.adminService.searchOrganizations(userId, query);
  }

  @Patch('plans/:code')
  async updatePlan(
    @CurrentUserId() userId: string,
    @Param() params: AdminPlanCodeParamDto,
    @Body() body: AdminUpdatePlanDto,
  ): Promise<AdminPlanDto> {
    return await this.adminService.updatePlan(userId, params.code, body);
  }

  @Post('plans')
  async createPlan(
    @CurrentUserId() userId: string,
    @CurrentAdminUser() adminUser: AdminUserEntity,
    @Body() body: AdminCreatePlanDto,
  ): Promise<AdminPlanDto> {
    return await this.adminService.createPlan(userId, adminUser.role, body);
  }

  @Patch('users/:userId')
  async updateUser(
    @CurrentUserId() currentUserId: string,
    @Param() params: AdminUserIdParamDto,
    @Body() body: AdminUpdateUserDto,
  ): Promise<AdminUserDto> {
    return await this.adminService.updateUser(
      currentUserId,
      params.userId,
      body,
    );
  }

  @Patch('organizations/:organizationId')
  async updateOrganization(
    @CurrentUserId() userId: string,
    @Param() params: AdminOrganizationIdParamDto,
    @Body() body: AdminUpdateOrganizationDto,
  ): Promise<AdminOrganizationDto> {
    return await this.adminService.updateOrganization(
      userId,
      params.organizationId,
      body,
    );
  }

  @Patch('workspaces/:workspaceId')
  async updateWorkspace(
    @CurrentUserId() userId: string,
    @Param() params: AdminWorkspaceIdParamDto,
    @Body() body: AdminUpdateWorkspaceDto,
  ): Promise<AdminWorkspaceDto> {
    return await this.adminService.updateWorkspace(
      userId,
      params.workspaceId,
      body,
    );
  }
}
