import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ObserveService } from './observe.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';

@Controller('api/v1/observe')
@UseGuards(JwtAuthGuard)
export class ObserveController {
  constructor(private readonly observeService: ObserveService) {}

  // 1. 대시보드 통계 메트릭
  @Get('overview')
  @Get('overview')
  async getOverviewMetrics(
    @Query('workspaceId') workspaceId: string,
    @CurrentUserId() userId: string,
  ) {
    return await this.observeService.getOverviewMetrics(workspaceId, userId);
  }

  // 2. 시간별 이용량 & 비용 시계열 차트 데이터
  @Get('analytics')
  @Get('analytics')
  async getAnalytics(
    @Query('workspaceId') workspaceId: string,
    @Query('days') days: string | undefined,
    @CurrentUserId() userId: string,
  ) {
    const dayCount = this.parsePositiveInt(days, 7);
    return await this.observeService.getAnalytics(
      workspaceId,
      userId,
      dayCount,
    );
  }

  // 3. 에이전트 목록 및 가독성 통계
  @Get('agents')
  async getAgentStats(
    @Query('workspaceId') workspaceId: string,
    @CurrentUserId() userId: string,
  ) {
    return await this.observeService.getAgentStats(workspaceId, userId);
  }

  // 4. 세션 목록 조회
  @Get('sessions')
  async getSessions(
    @Query('workspaceId') workspaceId: string,
    @Query('status') status: string | undefined,
    @CurrentUserId() userId: string,
  ) {
    return await this.observeService.getSessions(workspaceId, userId, status);
  }

  // 5. 세션 상세 타임라인 (스팬 트리)
  @Get('sessions/:id/timeline')
  async getSessionTimeline(
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
    @CurrentUserId() userId: string,
  ) {
    return await this.observeService.getSessionTimeline(
      workspaceId,
      userId,
      id,
    );
  }

  // 6. 에러 로그 조회
  @Get('errors')
  async getRecentErrors(
    @Query('workspaceId') workspaceId: string,
    @Query('limit') limit: string | undefined,
    @CurrentUserId() userId: string,
  ) {
    const limitVal = this.parsePositiveInt(limit, 50);
    return await this.observeService.getRecentErrors(
      workspaceId,
      userId,
      limitVal,
    );
  }

  private parsePositiveInt(value: string | undefined, fallback: number) {
    if (!value) return fallback;

    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
