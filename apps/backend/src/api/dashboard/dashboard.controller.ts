import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  DashboardQueryDto,
  DashboardHomeMetricsDto,
  DashboardStatusMetricsDto,
  DashboardMetricsDataDto,
  DashboardUsageMetricsDto,
  DashboardCostMetricsDto,
  DashboardInsightsDto,
} from '@repo/dto';

type AuthenticatedRequest = Request & { user?: { sub: string } };

@Controller('v1/observe/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * 대시보드 홈(요약) 화면의 KPI 정보 및 시계열 트렌드 데이터를 조회합니다.
   */
  @Get('home')
  async getHomeMetrics(
    @Query() query: DashboardQueryDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<DashboardHomeMetricsDto> {
    return await this.dashboardService.getHomeMetrics(
      query.workspaceId,
      req.user!.sub,
    );
  }

  /**
   * 시스템 정상 가동률(SLO) 및 에이전트/도구/모델의 가동/성공률 상태를 조회합니다.
   */
  @Get('status')
  async getStatusMetrics(
    @Query() query: DashboardQueryDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<DashboardStatusMetricsDto> {
    return await this.dashboardService.getStatusMetrics(
      query.workspaceId,
      req.user!.sub,
    );
  }

  /**
   * 실시간 지연시간 백분위 및 카테고리별 에러율 지표를 상세 조회합니다.
   */
  @Get('metrics')
  async getMetricsData(
    @Query() query: DashboardQueryDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<DashboardMetricsDataDto> {
    return await this.dashboardService.getMetricsData(
      query.workspaceId,
      req.user!.sub,
    );
  }

  /**
   * 에이전트 호출 비중 및 사용자 활동성, 7x24 히트맵 지표를 조회합니다.
   */
  @Get('usage')
  async getUsageMetrics(
    @Query() query: DashboardQueryDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<DashboardUsageMetricsDto> {
    return await this.dashboardService.getUsageMetrics(
      query.workspaceId,
      req.user!.sub,
    );
  }

  /**
   * 모델 및 도구 호출 관련 기여 비용 지표 및 이상 비용 발생 정보를 조회합니다.
   */
  @Get('cost')
  async getCostMetrics(
    @Query() query: DashboardQueryDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<DashboardCostMetricsDto> {
    return await this.dashboardService.getCostMetrics(
      query.workspaceId,
      req.user!.sub,
    );
  }

  /**
   * AI 에이전트 실패율 급증 및 비정상 지출 패턴에 관한 자동 원인 진단(RCA) 정보를 조회합니다.
   */
  @Get('insights')
  async getInsights(
    @Query() query: DashboardQueryDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<DashboardInsightsDto> {
    return await this.dashboardService.getInsights(
      query.workspaceId,
      req.user!.sub,
    );
  }
}
