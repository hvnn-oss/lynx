import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AdminUserEntity } from '@repo/database';
import type { Request } from 'express';
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
import { AdminService } from './admin.service';

type AuthenticatedRequest = Request & {
  user?: { sub: string };
  adminUser?: AdminUserEntity;
};

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('me')
  async getMe(@Req() req: AuthenticatedRequest): Promise<AdminMeDto> {
    return await this.adminService.getMe(req.user!.sub);
  }

  @Get('dashboard')
  async getDashboard(
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminDashboardDto> {
    return await this.adminService.getDashboard(req.user!.sub);
  }

  @Get('organizations/search')
  async searchOrganizations(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminOrganizationSearchQueryDto,
  ): Promise<AdminOrganizationSearchResponseDto> {
    return await this.adminService.searchOrganizations(req.user!.sub, query);
  }

  @Patch('plans/:code')
  async updatePlan(
    @Req() req: AuthenticatedRequest,
    @Param() params: AdminPlanCodeParamDto,
    @Body() body: AdminUpdatePlanDto,
  ): Promise<AdminPlanDto> {
    return await this.adminService.updatePlan(req.user!.sub, params.code, body);
  }

  @Post('plans')
  async createPlan(
    @Req() req: AuthenticatedRequest,
    @Body() body: AdminCreatePlanDto,
  ): Promise<AdminPlanDto> {
    return await this.adminService.createPlan(
      req.user!.sub,
      req.adminUser!.role,
      body,
    );
  }

  @Patch('users/:userId')
  async updateUser(
    @Req() req: AuthenticatedRequest,
    @Param() params: AdminUserIdParamDto,
    @Body() body: AdminUpdateUserDto,
  ): Promise<AdminUserDto> {
    return await this.adminService.updateUser(
      req.user!.sub,
      params.userId,
      body,
    );
  }

  @Patch('organizations/:organizationId')
  async updateOrganization(
    @Req() req: AuthenticatedRequest,
    @Param() params: AdminOrganizationIdParamDto,
    @Body() body: AdminUpdateOrganizationDto,
  ): Promise<AdminOrganizationDto> {
    return await this.adminService.updateOrganization(
      req.user!.sub,
      params.organizationId,
      body,
    );
  }

  @Patch('workspaces/:workspaceId')
  async updateWorkspace(
    @Req() req: AuthenticatedRequest,
    @Param() params: AdminWorkspaceIdParamDto,
    @Body() body: AdminUpdateWorkspaceDto,
  ): Promise<AdminWorkspaceDto> {
    return await this.adminService.updateWorkspace(
      req.user!.sub,
      params.workspaceId,
      body,
    );
  }
}
