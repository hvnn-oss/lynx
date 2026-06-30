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
  CreateWorkspaceApiKeyDto,
  CreateWorkspaceDto,
  UpdateWorkspaceApiKeyDto,
  UpdateWorkspaceDto,
  WorkspaceApiKeyIdParamDto,
  WorkspaceIdParamDto,
} from '@repo/dto';
import type {
  CreatedWorkspaceApiKeyDto,
  SuccessResponseDto,
  WorkspaceApiKeyDto,
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

  @Get(':workspaceId/api-keys')
  async listApiKeys(
    @Param() params: WorkspaceIdParamDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<WorkspaceApiKeyDto[]> {
    return await this.workspaceService.listApiKeys(
      params.workspaceId,
      req.user!.sub,
    );
  }

  @Post(':workspaceId/api-keys')
  async createApiKey(
    @Param() params: WorkspaceIdParamDto,
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateWorkspaceApiKeyDto,
  ): Promise<CreatedWorkspaceApiKeyDto> {
    return await this.workspaceService.createApiKey(
      params.workspaceId,
      req.user!.sub,
      body,
    );
  }

  @Patch(':workspaceId/api-keys/:apiKeyId')
  async updateApiKey(
    @Param() params: WorkspaceApiKeyIdParamDto,
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateWorkspaceApiKeyDto,
  ): Promise<WorkspaceApiKeyDto> {
    return await this.workspaceService.updateApiKey(
      params.workspaceId,
      params.apiKeyId,
      req.user!.sub,
      body,
    );
  }

  @Delete(':workspaceId/api-keys/:apiKeyId')
  async revokeApiKey(
    @Param() params: WorkspaceApiKeyIdParamDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SuccessResponseDto> {
    return await this.workspaceService.revokeApiKey(
      params.workspaceId,
      params.apiKeyId,
      req.user!.sub,
    );
  }
}
