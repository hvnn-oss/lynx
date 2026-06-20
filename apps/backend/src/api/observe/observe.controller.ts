import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ObserveService } from './observe.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/v1/observe')
@UseGuards(JwtAuthGuard)
export class ObserveController {
  constructor(private readonly observeService: ObserveService) {}

  // 1. 대시보드 통계 메트릭
  @Get('overview')
  async getOverviewMetrics(@Query('workspaceId') workspaceId: string) {
    return await this.observeService.getOverviewMetrics(workspaceId);
  }

  // 2. 시간별 이용량 & 비용 시계열 차트 데이터
  @Get('analytics')
  async getAnalytics(
    @Query('workspaceId') workspaceId: string,
    @Query('days') days?: string,
  ) {
    const dayCount = days ? parseInt(days, 10) : 7;
    return await this.observeService.getAnalytics(workspaceId, dayCount);
  }

  // 3. 에이전트 목록 및 가독성 통계
  @Get('agents')
  async getAgentStats(@Query('workspaceId') workspaceId: string) {
    return await this.observeService.getAgentStats(workspaceId);
  }

  // 4. 세션 목록 조회
  @Get('sessions')
  async getSessions(
    @Query('workspaceId') workspaceId: string,
    @Query('status') status?: string,
  ) {
    return await this.observeService.getSessions(workspaceId, status);
  }

  // 5. 세션 상세 타임라인 (스팬 트리)
  @Get('sessions/:id/timeline')
  async getSessionTimeline(@Param('id') id: string) {
    return await this.observeService.getSessionTimeline(id);
  }

  // 6. 에러 로그 조회
  @Get('errors')
  async getRecentErrors(
    @Query('workspaceId') workspaceId: string,
    @Query('limit') limit?: string,
  ) {
    const limitVal = limit ? parseInt(limit, 10) : 50;
    return await this.observeService.getRecentErrors(workspaceId, limitVal);
  }
}
