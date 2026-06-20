import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  OrganizationService,
  UpdateSsoSettingsDto,
} from './organization.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('organization')
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  // 조직의 SSO 연동 설정을 조회합니다.
  @Get('/:id/sso')
  @UseGuards(JwtAuthGuard)
  async getSsoSettings(@Param('id') id: string) {
    return await this.orgService.getSsoSettings(id);
  }

  // 조직의 SSO 연동 설정을 갱신합니다.
  @Post('/:id/sso')
  @UseGuards(JwtAuthGuard)
  async updateSsoSettings(
    @Param('id') id: string,
    @Body() settings: UpdateSsoSettingsDto,
  ) {
    return await this.orgService.updateSsoSettings(id, settings);
  }
}
