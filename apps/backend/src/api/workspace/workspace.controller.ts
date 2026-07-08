import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
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
import { CurrentUserId } from '../../common/decorators/current-user.decorator';
import { WorkspaceService } from './workspace.service';

@Controller('workspace')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get()
  async listWorkspaces(
    @CurrentUserId() userId: string,
  ): Promise<WorkspaceSummaryDto[]> {
    return await this.workspaceService.listWorkspaces(userId);
  }

  @Post()
  async createWorkspace(
    @CurrentUserId() userId: string,
    @Body() body: CreateWorkspaceDto,
  ): Promise<WorkspaceDetailDto> {
    return await this.workspaceService.createWorkspace(userId, body);
  }

  @Get(':workspaceId')
  async getWorkspace(
    @Param() params: WorkspaceIdParamDto,
    @CurrentUserId() userId: string,
  ): Promise<WorkspaceDetailDto> {
    return await this.workspaceService.getWorkspace(params.workspaceId, userId);
  }

  @Patch(':workspaceId')
  async updateWorkspace(
    @Param() params: WorkspaceIdParamDto,
    @CurrentUserId() userId: string,
    @Body() body: UpdateWorkspaceDto,
  ): Promise<WorkspaceDetailDto> {
    return await this.workspaceService.updateWorkspace(
      params.workspaceId,
      userId,
      body,
    );
  }

  @Delete(':workspaceId')
  async deleteWorkspace(
    @Param() params: WorkspaceIdParamDto,
    @CurrentUserId() userId: string,
  ): Promise<SuccessResponseDto> {
    return await this.workspaceService.deleteWorkspace(
      params.workspaceId,
      userId,
    );
  }

  @Post(':workspaceId/api-key/rotate')
  async rotateApiKey(
    @Param() params: WorkspaceIdParamDto,
    @CurrentUserId() userId: string,
  ): Promise<WorkspaceApiKeyResponseDto> {
    return await this.workspaceService.rotateApiKey(params.workspaceId, userId);
  }

  @Get(':workspaceId/api-keys')
  async listApiKeys(
    @Param() params: WorkspaceIdParamDto,
    @CurrentUserId() userId: string,
  ): Promise<WorkspaceApiKeyDto[]> {
    return await this.workspaceService.listApiKeys(params.workspaceId, userId);
  }

  @Post(':workspaceId/api-keys')
  async createApiKey(
    @Param() params: WorkspaceIdParamDto,
    @CurrentUserId() userId: string,
    @Body() body: CreateWorkspaceApiKeyDto,
  ): Promise<CreatedWorkspaceApiKeyDto> {
    return await this.workspaceService.createApiKey(
      params.workspaceId,
      userId,
      body,
    );
  }

  @Patch(':workspaceId/api-keys/:apiKeyId')
  async updateApiKey(
    @Param() params: WorkspaceApiKeyIdParamDto,
    @CurrentUserId() userId: string,
    @Body() body: UpdateWorkspaceApiKeyDto,
  ): Promise<WorkspaceApiKeyDto> {
    return await this.workspaceService.updateApiKey(
      params.workspaceId,
      params.apiKeyId,
      userId,
      body,
    );
  }

  @Delete(':workspaceId/api-keys/:apiKeyId')
  async revokeApiKey(
    @Param() params: WorkspaceApiKeyIdParamDto,
    @CurrentUserId() userId: string,
  ): Promise<SuccessResponseDto> {
    return await this.workspaceService.revokeApiKey(
      params.workspaceId,
      params.apiKeyId,
      userId,
    );
  }
}
