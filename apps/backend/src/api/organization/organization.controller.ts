import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  OrganizationService,
  UpdateSsoSettingsDto,
} from './organization.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Request } from 'express';

type AuthenticatedRequest = Request & { user?: { sub: string } };

@Controller('organization')
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  // 조직의 SSO 연동 설정을 조회합니다.
  @Get('/:id/sso')
  @UseGuards(JwtAuthGuard)
  async getSsoSettings(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return await this.orgService.getSsoSettings(id, req.user!.sub);
  }

  // 조직의 SSO 연동 설정을 갱신합니다.
  @Post('/:id/sso')
  @UseGuards(JwtAuthGuard)
  async updateSsoSettings(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() settings: UpdateSsoSettingsDto,
  ) {
    return await this.orgService.updateSsoSettings(id, req.user!.sub, settings);
  }
}
