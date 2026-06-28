import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  WorkspaceIdParamDto,
} from '@repo/dto';
import type {
  SuccessResponseDto,
  WorkspaceApiKeyResponseDto,
  WorkspaceDetailDto,
  WorkspaceSummaryDto,
} from '@repo/dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceService } from './workspace.service';

type AuthenticatedRequest = Request & { user?: { sub: string } };

@Controller('workspace')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get()
  async listWorkspaces(
    @Req() req: AuthenticatedRequest,
  ): Promise<WorkspaceSummaryDto[]> {
    return await this.workspaceService.listWorkspaces(req.user!.sub);
  }

  @Post()
  async createWorkspace(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateWorkspaceDto,
  ): Promise<WorkspaceDetailDto> {
    return await this.workspaceService.createWorkspace(req.user!.sub, body);
  }

  @Get(':workspaceId')
  async getWorkspace(
    @Param() params: WorkspaceIdParamDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<WorkspaceDetailDto> {
    return await this.workspaceService.getWorkspace(
      params.workspaceId,
      req.user!.sub,
    );
  }

  @Patch(':workspaceId')
  async updateWorkspace(
    @Param() params: WorkspaceIdParamDto,
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateWorkspaceDto,
  ): Promise<WorkspaceDetailDto> {
    return await this.workspaceService.updateWorkspace(
      params.workspaceId,
      req.user!.sub,
      body,
    );
  }

  @Delete(':workspaceId')
  async deleteWorkspace(
    @Param() params: WorkspaceIdParamDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SuccessResponseDto> {
    return await this.workspaceService.deleteWorkspace(
      params.workspaceId,
      req.user!.sub,
    );
  }

  @Post(':workspaceId/api-key/rotate')
  async rotateApiKey(
    @Param() params: WorkspaceIdParamDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<WorkspaceApiKeyResponseDto> {
    return await this.workspaceService.rotateApiKey(
      params.workspaceId,
      req.user!.sub,
    );
  }
}
