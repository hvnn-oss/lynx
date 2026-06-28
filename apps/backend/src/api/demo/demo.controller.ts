import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  DashboardCostMetricsDto,
  DashboardHomeMetricsDto,
  DashboardInsightsDto,
  DashboardMetricsDataDto,
  DashboardStatusMetricsDto,
  DashboardUsageMetricsDto,
} from '@repo/dto';
import { DashboardService } from '../dashboard/dashboard.service';

@Controller('api/v1/demo')
export class DemoController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly configService: ConfigService,
  ) {}

  @Get('dashboard/home')
  getDashboardHome(): DashboardHomeMetricsDto {
    this.assertDemoEnabled();
    return this.dashboardService.getDemoHomeMetrics();
  }

  @Get('dashboard/status')
  getDashboardStatus(): DashboardStatusMetricsDto {
    this.assertDemoEnabled();
    return this.dashboardService.getDemoStatusMetrics();
  }

  @Get('dashboard/metrics')
  getDashboardMetrics(): DashboardMetricsDataDto {
    this.assertDemoEnabled();
    return this.dashboardService.getDemoMetricsData();
  }

  @Get('dashboard/usage')
  getDashboardUsage(): DashboardUsageMetricsDto {
    this.assertDemoEnabled();
    return this.dashboardService.getDemoUsageMetrics();
  }

  @Get('dashboard/cost')
  getDashboardCost(): DashboardCostMetricsDto {
    this.assertDemoEnabled();
    return this.dashboardService.getDemoCostMetrics();
  }

  @Get('dashboard/insights')
  getDashboardInsights(): DashboardInsightsDto {
    this.assertDemoEnabled();
    return this.dashboardService.getDemoInsights();
  }

  private assertDemoEnabled(): void {
    if (this.configService.get<string>('ENABLE_DEMO_DATA') !== 'true') {
      throw new NotFoundException({ message: 'Demo data is not enabled.' });
    }
  }
}
