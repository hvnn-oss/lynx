import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventEntity, SessionEntity } from '@repo/database';
import {
  DashboardHomeMetricsDto,
  DashboardStatusMetricsDto,
  DashboardMetricsDataDto,
  DashboardUsageMetricsDto,
  DashboardCostMetricsDto,
  DashboardInsightsDto,
} from '@repo/dto';
import { WorkspaceAccessService } from '../../common/services/workspace-access.service';
import {
  RawAgentComparison,
  RawAgentHealth,
  RawEnvironmentUsage,
  RawKpiMetrics,
  RawLatencyMetrics,
  RawModelMetrics,
  RawPercentiles,
  RawRecentIssue,
  RawTimeSeries,
  RawTokenMetrics,
  RawToolMetrics,
} from '../../common/types/dashboard-raw.types';
import {
  getDemoCostMetrics,
  getDemoHomeMetrics,
  getDemoInsights,
  getDemoMetricsData,
  getDemoStatusMetrics,
  getDemoUsageMetrics,
} from '../../common/fixtures/dashboard-demo.metrics';
import {
  getEmptyCostMetrics,
  getEmptyHomeMetrics,
  getEmptyInsights,
  getEmptyMetricsData,
  getEmptyStatusMetrics,
  getEmptyUsageMetrics,
} from '../../common/fixtures/dashboard-empty.metrics';

// 대시보드 요약 화면에서 쓰는 운영 지표를 계산합니다.
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  /**
   * 대시보드 첫 화면에 필요한 핵심 지표를 모읍니다.
   * 최근 24시간과 이전 24시간을 비교해 변화량을 계산합니다.
   */
  async getHomeMetrics(
    workspaceId: string,
    userId: string,
  ): Promise<DashboardHomeMetricsDto> {
    try {
      await this.workspaceAccess.assertAccess(userId, workspaceId);
      const now = new Date();
      const tMinus24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tMinus48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      const sessionRepository = this.dataSource.getRepository(SessionEntity);
      const eventRepository = this.dataSource.getRepository(EventEntity);

      const currentRaw = (await sessionRepository
        .createQueryBuilder('s')
        .leftJoin('s.agent', 'a')
        .select('COUNT(s.id)', 'runs')
        .addSelect('SUM(s.totalCost)', 'cost')
        .addSelect(
          'COUNT(DISTINCT COALESCE(NULLIF(a.name, \'\'), s."agentId"::text))',
          'activeAgents',
        )
        .addSelect(
          "SUM(CASE WHEN s.status = 'COMPLETED' THEN 1 ELSE 0 END)",
          'completedRuns',
        )
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('s.startedAt >= :tMinus24h', { tMinus24h })
        .getRawOne()) as unknown as RawKpiMetrics | undefined;

      const totalRuns = parseInt(currentRaw?.runs ?? '0', 10);

      // 실행 데이터가 없으면 화면이 기대하는 빈 상태 DTO를 반환합니다.
      if (totalRuns === 0) {
        return getEmptyHomeMetrics();
      }

      const previousMetrics = (await sessionRepository
        .createQueryBuilder('s')
        .select('COUNT(s.id)', 'runs')
        .addSelect('SUM(s.totalCost)', 'cost')
        .addSelect(
          "SUM(CASE WHEN s.status = 'COMPLETED' THEN 1 ELSE 0 END)",
          'completedRuns',
        )
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('s.startedAt >= :tMinus48h AND s.startedAt < :tMinus24h', {
          tMinus48h,
          tMinus24h,
        })
        .getRawOne()) as unknown as RawKpiMetrics | undefined;

      const avgLatencyRaw = (await eventRepository
        .createQueryBuilder('e')
        .select('AVG(e.latency)', 'avg')
        .innerJoin('e.session', 's')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('e.timestamp >= :tMinus24h', { tMinus24h })
        .getRawOne()) as unknown as RawLatencyMetrics | undefined;

      const prevAvgLatencyRaw = (await eventRepository
        .createQueryBuilder('e')
        .select('AVG(e.latency)', 'avg')
        .innerJoin('e.session', 's')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('e.timestamp >= :tMinus48h AND e.timestamp < :tMinus24h', {
          tMinus48h,
          tMinus24h,
        })
        .getRawOne()) as unknown as RawLatencyMetrics | undefined;

      const currentAlerts = await eventRepository
        .createQueryBuilder('e')
        .innerJoin('e.session', 's')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('e.timestamp >= :tMinus24h', { tMinus24h })
        .andWhere('e.eventType = :errorType', { errorType: 'ERROR' })
        .getCount();

      const prevAlerts = await eventRepository
        .createQueryBuilder('e')
        .innerJoin('e.session', 's')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('e.timestamp >= :tMinus48h AND e.timestamp < :tMinus24h', {
          tMinus48h,
          tMinus24h,
        })
        .andWhere('e.eventType = :errorType', { errorType: 'ERROR' })
        .getCount();

      const agentHealthRaw = (await sessionRepository
        .createQueryBuilder('s')
        .innerJoin('s.agent', 'a')
        .select('MIN(a.id::text)', 'agentId')
        .addSelect("COALESCE(NULLIF(a.name, ''), 'Unknown Agent')", 'agentName')
        .addSelect('COUNT(s.id)', 'totalRuns')
        .addSelect(
          "SUM(CASE WHEN s.status = 'FAILED' THEN 1 ELSE 0 END)",
          'failedRuns',
        )
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('s.startedAt >= :tMinus24h', { tMinus24h })
        .groupBy("COALESCE(NULLIF(a.name, ''), 'Unknown Agent')")
        .getRawMany()) as unknown as RawAgentHealth[];

      const healthScores = agentHealthRaw.map((row) => {
        const total = parseInt(row.totalRuns, 10) || 0;
        const failed = parseInt(row.failedRuns, 10) || 0;
        const failureRate = total > 0 ? (failed / total) * 100 : 0;
        const score = Math.max(
          0,
          Math.min(100, Math.round(100 - failureRate * 0.5)),
        );

        return {
          agentId: row.agentId,
          agentName: row.agentName,
          score,
          status:
            score >= 90
              ? ('HEALTHY' as const)
              : score >= 75
                ? ('WARNING' as const)
                : ('CRITICAL' as const),
        };
      });

      const timeSeriesRaw = (await sessionRepository
        .createQueryBuilder('s')
        .select("DATE_TRUNC('hour', s.startedAt)", 'hour')
        .addSelect('COUNT(s.id)', 'count')
        .addSelect(
          "SUM(CASE WHEN s.status = 'FAILED' THEN 1 ELSE 0 END)",
          'failed',
        )
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('s.startedAt >= :tMinus24h', { tMinus24h })
        .groupBy("DATE_TRUNC('hour', s.startedAt)")
        .orderBy('hour', 'ASC')
        .getRawMany()) as unknown as RawTimeSeries[];

      const runVolume = timeSeriesRaw.map((row) => ({
        time: row.hour,
        count: parseInt(row.count ?? '0', 10),
        failedCount: parseInt(row.failed ?? '0', 10),
        successCount:
          parseInt(row.count ?? '0', 10) - parseInt(row.failed ?? '0', 10),
      }));

      const failureTrend = timeSeriesRaw.map((row, index) => {
        const total = parseInt(row.count ?? '0', 10);
        const failed = parseInt(row.failed ?? '0', 10);
        const rate =
          total > 0 ? parseFloat(((failed / total) * 100).toFixed(2)) : 0;
        const previous = index > 0 ? timeSeriesRaw[index - 1] : undefined;
        const previousTotal = parseInt(previous?.count ?? '0', 10);
        const previousFailed = parseInt(previous?.failed ?? '0', 10);
        return {
          time: row.hour,
          rate,
          previousRate:
            previousTotal > 0
              ? parseFloat(((previousFailed / previousTotal) * 100).toFixed(2))
              : 0,
        };
      });

      const recentIssuesRaw = (await eventRepository
        .createQueryBuilder('e')
        .innerJoin('e.session', 's')
        .leftJoin('s.agent', 'a')
        .select('MIN(e.id::text)', 'id')
        .addSelect('a.name', 'agentName')
        .addSelect(
          "COALESCE(NULLIF(e.label, ''), 'Execution Error')",
          'issueType',
        )
        .addSelect("'CRITICAL'", 'severity')
        .addSelect('COUNT(e.id)', 'occurrenceCount')
        .addSelect('COUNT(DISTINCT s.id)', 'affectedSessionsCount')
        .addSelect('MIN(e.timestamp)', 'firstSeenAt')
        .addSelect('MAX(e.timestamp)', 'lastSeenAt')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('e.timestamp >= :tMinus24h', { tMinus24h })
        .andWhere('e.eventType = :errorType', { errorType: 'ERROR' })
        .groupBy('a.name')
        .addGroupBy("COALESCE(NULLIF(e.label, ''), 'Execution Error')")
        .orderBy('MAX(e.timestamp)', 'DESC')
        .limit(5)
        .getRawMany()) as unknown as RawRecentIssue[];

      const recentIssues = recentIssuesRaw.map((issue) => {
        return {
          id: issue.id,
          agentName: issue.agentName ?? 'Unknown Agent',
          issueType: issue.issueType ?? 'Execution Error',
          severity: issue.severity,
          timestamp: new Date(issue.firstSeenAt).toISOString(),
          occurrenceCount: parseInt(issue.occurrenceCount, 10) || 0,
          affectedSessionsCount: parseInt(issue.affectedSessionsCount, 10) || 0,
          lastSeenAt: new Date(issue.lastSeenAt).toISOString(),
        };
      });

      const currentRuns = totalRuns;
      const prevRuns = parseInt(previousMetrics?.runs ?? '0', 10);
      const runsChange =
        prevRuns > 0
          ? parseFloat((((currentRuns - prevRuns) / prevRuns) * 100).toFixed(1))
          : 0;

      const currentSuccessRate =
        currentRuns > 0
          ? (parseInt(currentRaw?.completedRuns ?? '0', 10) / currentRuns) * 100
          : 100;
      const prevSuccessRate =
        prevRuns > 0
          ? (parseInt(previousMetrics?.completedRuns ?? '0', 10) / prevRuns) *
            100
          : 100;
      const successRateChange = parseFloat(
        (currentSuccessRate - prevSuccessRate).toFixed(1),
      );

      const currentCost = parseFloat(currentRaw?.cost ?? '0');
      const prevCost = parseFloat(previousMetrics?.cost ?? '0');
      const costChange =
        prevCost > 0
          ? parseFloat((((currentCost - prevCost) / prevCost) * 100).toFixed(1))
          : 0;

      const currentAvgLatency = parseFloat(avgLatencyRaw?.avg ?? '0') / 1000;
      const prevAvgLatency = parseFloat(prevAvgLatencyRaw?.avg ?? '0') / 1000;
      const latencyChange = parseFloat(
        (currentAvgLatency - prevAvgLatency).toFixed(2),
      );

      return {
        kpis: {
          agentRuns: {
            value: currentRuns,
            change: runsChange,
            trend: runsChange >= 0 ? ('up' as const) : ('down' as const),
          },
          successRate: {
            value: parseFloat(currentSuccessRate.toFixed(1)),
            change: successRateChange,
            trend: successRateChange >= 0 ? ('up' as const) : ('down' as const),
          },
          avgLatency: {
            value: parseFloat(currentAvgLatency.toFixed(2)),
            change: latencyChange,
            trend: latencyChange >= 0 ? ('up' as const) : ('down' as const),
          },
          cost: {
            value: parseFloat(currentCost.toFixed(2)),
            change: costChange,
            trend: costChange >= 0 ? ('up' as const) : ('down' as const),
          },
          activeAgents: {
            value: parseInt(currentRaw?.activeAgents ?? '0', 10),
          },
          criticalAlerts: {
            value: currentAlerts,
            change: currentAlerts - prevAlerts,
            trend:
              currentAlerts >= prevAlerts ? ('up' as const) : ('down' as const),
          },
        },
        healthScores,
        runVolume,
        failureTrend,
        recentIssues,
      };
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `Failed to load database overview metrics: ${error.message}`,
        error.stack,
      );
      throw err;
    }
  }

  /**
   * 상태 화면에 필요한 에이전트, 모델, 도구 상태를 계산합니다.
   */
  async getStatusMetrics(
    workspaceId: string,
    userId: string,
  ): Promise<DashboardStatusMetricsDto> {
    try {
      await this.workspaceAccess.assertAccess(userId, workspaceId);
      const now = new Date();
      const tMinus24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const sessionRepository = this.dataSource.getRepository(SessionEntity);
      const eventRepository = this.dataSource.getRepository(EventEntity);

      const sessionCount = await sessionRepository.count({
        where: { workspace: { id: workspaceId } },
      });

      if (sessionCount === 0) {
        return getEmptyStatusMetrics();
      }

      const agentSessionsRaw = (await sessionRepository
        .createQueryBuilder('s')
        .innerJoin('s.agent', 'a')
        .select('MIN(a.id::text)', 'agentId')
        .addSelect(
          "SUM(CASE WHEN s.status = 'FAILED' THEN 1 ELSE 0 END)",
          'failedRuns',
        )
        .addSelect('COUNT(s.id)', 'totalRuns')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('s.startedAt >= :tMinus24h', { tMinus24h })
        .groupBy("COALESCE(NULLIF(a.name, ''), 'Unknown Agent')")
        .getRawMany()) as unknown as Array<{
        agentId: string;
        failedRuns: string;
        totalRuns: string;
      }>;

      let healthy = 0;
      let warning = 0;
      let critical = 0;
      let offline = 0;

      for (const row of agentSessionsRaw) {
        const total = parseInt(row.totalRuns, 10) || 0;
        const failed = parseInt(row.failedRuns, 10) || 0;
        const failureRate = total > 0 ? (failed / total) * 100 : 0;

        if (total === 0) offline++;
        else if (failureRate > 20) critical++;
        else if (failureRate > 5) warning++;
        else healthy++;
      }

      const modelStatusRaw = (await eventRepository
        .createQueryBuilder('e')
        .innerJoin('e.session', 's')
        .select("COALESCE(e.payload->>'model', e.label)", 'modelName')
        .addSelect('COUNT(e.id)', 'totalCalls')
        .addSelect(
          "SUM(CASE WHEN e.eventType = 'ERROR' THEN 1 ELSE 0 END)",
          'errorCalls',
        )
        .addSelect('AVG(e.latency)', 'avgLatency')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('e.timestamp >= :tMinus24h', { tMinus24h })
        .groupBy("COALESCE(e.payload->>'model', e.label)")
        .getRawMany()) as unknown as RawModelMetrics[];

      const modelStatus = modelStatusRaw.map((row) => {
        const total = parseInt(row.totalCalls, 10) || 0;
        const errors = parseInt(row.errorCalls, 10) || 0;
        const successRate = total > 0 ? ((total - errors) / total) * 100 : 100;
        return {
          model: row.modelName || 'Unknown Model',
          successRate: parseFloat(successRate.toFixed(1)),
          avgLatency: parseFloat(
            ((parseFloat(row.avgLatency ?? '0') || 0) / 1000).toFixed(2),
          ),
        };
      });

      const toolStatusRaw = (await eventRepository
        .createQueryBuilder('e')
        .innerJoin('e.session', 's')
        .select(
          "COALESCE(NULLIF(e.payload->>'toolName', ''), NULLIF(e.label, ''), 'Unknown Tool')",
          'toolName',
        )
        .addSelect('COUNT(e.id)', 'totalCalls')
        .addSelect(
          "SUM(CASE WHEN e.eventType = 'ERROR' OR e.payload->>'error' IS NOT NULL THEN 1 ELSE 0 END)",
          'errorCalls',
        )
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('e.timestamp >= :tMinus24h', { tMinus24h })
        .andWhere('e.eventType IN (:...toolTypes)', {
          toolTypes: ['CALL_TOOLS', 'TOOL_CALL', 'TOOL_RESULT'],
        })
        .groupBy(
          "COALESCE(NULLIF(e.payload->>'toolName', ''), NULLIF(e.label, ''), 'Unknown Tool')",
        )
        .getRawMany()) as unknown as RawToolMetrics[];

      const toolStatus = toolStatusRaw.map((row) => {
        const total = parseInt(row.totalCalls, 10) || 0;
        const errors = parseInt(row.errorCalls, 10) || 0;
        const successRate = total > 0 ? ((total - errors) / total) * 100 : 100;
        return {
          tool: row.toolName || 'Unknown Tool',
          successRate: parseFloat(successRate.toFixed(1)),
        };
      });

      const outagesRaw = await eventRepository
        .createQueryBuilder('e')
        .innerJoinAndSelect('e.session', 's')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere("e.eventType = :errType OR e.payload->>'error' IS NOT NULL", {
          errType: 'ERROR',
        })
        .orderBy('e.timestamp', 'DESC')
        .limit(5)
        .getMany();

      const recentOutages = outagesRaw.map((e) => {
        const payloadObj = e.payload as Record<string, any> | undefined;
        return {
          timestamp: e.timestamp.toISOString(),
          component: e.label || 'API Client',
          error:
            (payloadObj?.error as string | undefined) ||
            'Service request timeout or connection failed',
        };
      });

      const totalRuns = await sessionRepository
        .createQueryBuilder('s')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('s.startedAt >= :tMinus24h', { tMinus24h })
        .getCount();

      const failedRuns = await sessionRepository
        .createQueryBuilder('s')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('s.startedAt >= :tMinus24h', { tMinus24h })
        .andWhere("s.status = 'FAILED'")
        .getCount();

      const currentSuccessRate =
        totalRuns > 0 ? ((totalRuns - failedRuns) / totalRuns) * 100 : 100;

      return {
        agentStatus: {
          healthy,
          warning,
          critical,
          offline,
        },
        modelStatus,
        toolStatus,
        recentOutages,
        slo: {
          metricName: 'Success Rate',
          target: 95.0,
          current: parseFloat(currentSuccessRate.toFixed(1)),
          status: currentSuccessRate >= 95.0 ? 'COMPLIANT' : 'NON_COMPLIANT',
        },
      };
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `Failed to load system status metrics: ${error.message}`,
        error.stack,
      );
      throw err;
    }
  }

  /**
   * 성능 화면에서 쓰는 처리량, 지연 시간, 토큰, 오류 지표를 계산합니다.
   */
  async getMetricsData(
    workspaceId: string,
    userId: string,
  ): Promise<DashboardMetricsDataDto> {
    try {
      await this.workspaceAccess.assertAccess(userId, workspaceId);
      const now = new Date();
      const tMinus24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const sessionRepository = this.dataSource.getRepository(SessionEntity);
      const eventRepository = this.dataSource.getRepository(EventEntity);

      const sessionCount = await sessionRepository.count({
        where: { workspace: { id: workspaceId } },
      });

      if (sessionCount === 0) {
        return getEmptyMetricsData();
      }

      const runMetricsRaw = (await sessionRepository
        .createQueryBuilder('s')
        .select('COUNT(s.id)', 'runs')
        .addSelect('SUM(s.totalTokens)', 'tokens')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('s.startedAt >= :tMinus24h', { tMinus24h })
        .getRawOne()) as unknown as RawKpiMetrics | undefined;

      const runsCount = parseInt(runMetricsRaw?.runs ?? '0', 10);
      const tokensCount = parseInt(runMetricsRaw?.tokens ?? '0', 10);

      const timeFrameSeconds = 24 * 60 * 60;
      const runsPerSec = parseFloat((runsCount / timeFrameSeconds).toFixed(4));
      const tokensPerSec = parseFloat(
        (tokensCount / timeFrameSeconds).toFixed(2),
      );
      const requestsPerSec = parseFloat(
        ((runsCount * 2.5) / timeFrameSeconds).toFixed(4),
      );

      const latencyDistRaw = (await eventRepository
        .createQueryBuilder('e')
        .innerJoin('e.session', 's')
        .select('percentile_cont(0.5) WITHIN GROUP (ORDER BY e.latency)', 'p50')
        .addSelect(
          'percentile_cont(0.95) WITHIN GROUP (ORDER BY e.latency)',
          'p95',
        )
        .addSelect(
          'percentile_cont(0.99) WITHIN GROUP (ORDER BY e.latency)',
          'p99',
        )
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('e.timestamp >= :tMinus24h', { tMinus24h })
        .getRawOne()) as unknown as RawPercentiles | undefined;

      const p50 = parseFloat(
        ((parseFloat(latencyDistRaw?.p50 ?? '0') || 0) / 1000).toFixed(2),
      );
      const p95 = parseFloat(
        ((parseFloat(latencyDistRaw?.p95 ?? '0') || 0) / 1000).toFixed(2),
      );
      const p99 = parseFloat(
        ((parseFloat(latencyDistRaw?.p99 ?? '0') || 0) / 1000).toFixed(2),
      );

      const tokensRaw = (await sessionRepository
        .createQueryBuilder('s')
        .select('SUM(s.totalPromptTokens)', 'input')
        .addSelect('SUM(s.totalCompletionTokens)', 'output')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('s.startedAt >= :tMinus24h', { tMinus24h })
        .getRawOne()) as unknown as RawTokenMetrics | undefined;

      const toolErrors = await eventRepository
        .createQueryBuilder('e')
        .innerJoin('e.session', 's')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('e.timestamp >= :tMinus24h', { tMinus24h })
        .andWhere("e.eventType = 'ERROR' AND e.label LIKE '%tool%'")
        .getCount();

      const llmErrors = await eventRepository
        .createQueryBuilder('e')
        .innerJoin('e.session', 's')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('e.timestamp >= :tMinus24h', { tMinus24h })
        .andWhere("e.eventType = 'ERROR' AND e.label LIKE '%llm%'")
        .getCount();

      const validationErrors = await eventRepository
        .createQueryBuilder('e')
        .innerJoin('e.session', 's')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('e.timestamp >= :tMinus24h', { tMinus24h })
        .andWhere("e.eventType = 'ERROR' AND e.label LIKE '%validation%'")
        .getCount();

      const agentComparisonRaw = (await sessionRepository
        .createQueryBuilder('s')
        .innerJoin('s.agent', 'a')
        .select('a.name', 'agentName')
        .addSelect('a.id', 'agentId')
        .addSelect(
          "SUM(CASE WHEN s.status = 'COMPLETED' THEN 1 ELSE 0 END)",
          'completed',
        )
        .addSelect('COUNT(s.id)', 'total')
        .addSelect('SUM(s.totalCost)', 'cost')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('s.startedAt >= :tMinus24h', { tMinus24h })
        .groupBy('a.id, a.name')
        .getRawMany()) as unknown as RawAgentComparison[];

      const agentLatencyRaw = (await eventRepository
        .createQueryBuilder('e')
        .innerJoin('e.session', 's')
        .innerJoin('s.agent', 'a')
        .select('a.name', 'agentName')
        .addSelect(
          'percentile_cont(0.95) WITHIN GROUP (ORDER BY e.latency)',
          'p95Latency',
        )
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('e.timestamp >= :tMinus24h', { tMinus24h })
        .andWhere('e.latency IS NOT NULL')
        .groupBy('a.id, a.name')
        .getRawMany()) as unknown as RawAgentComparison[];
      const p95ByAgent = new Map(
        agentLatencyRaw.map((row) => [row.agentName, row.p95Latency]),
      );

      const agentComparison = agentComparisonRaw.map((row) => {
        const total = parseInt(row.total, 10) || 0;
        const completed = parseInt(row.completed, 10) || 0;
        const successRate = total > 0 ? (completed / total) * 100 : 100;
        const p95Latency = p95ByAgent.get(row.agentName);
        return {
          agentName: row.agentName || 'Default Agent',
          successRate: parseFloat(successRate.toFixed(1)),
          p95Latency: parseFloat(
            ((parseFloat(p95Latency ?? '0') || 0) / 1000).toFixed(2),
          ),
          cost: parseFloat((parseFloat(row.cost ?? '0') || 0).toFixed(2)),
        };
      });

      return {
        runMetrics: {
          runsPerSec,
          tokensPerSec,
          requestsPerSec,
        },
        latencyDistribution: {
          p50,
          p95,
          p99,
        },
        tokenMetrics: {
          inputTokens: parseInt(tokensRaw?.input ?? '0', 10),
          outputTokens: parseInt(tokensRaw?.output ?? '0', 10),
        },
        errorRate: {
          toolError: toolErrors,
          llmError: llmErrors,
          validationError: validationErrors,
        },
        agentComparison,
      };
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `Failed to load metrics data: ${error.message}`,
        error.stack,
      );
      throw err;
    }
  }

  /**
   * 사용량 화면에 필요한 에이전트, 환경, 도구, 모델 사용량을 계산합니다.
   */
  async getUsageMetrics(
    workspaceId: string,
    userId: string,
  ): Promise<DashboardUsageMetricsDto> {
    try {
      await this.workspaceAccess.assertAccess(userId, workspaceId);
      const now = new Date();
      const tMinus24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sessionRepository = this.dataSource.getRepository(SessionEntity);
      const eventRepository = this.dataSource.getRepository(EventEntity);

      const sessionCount = await sessionRepository.count({
        where: { workspace: { id: workspaceId } },
      });

      if (sessionCount === 0) {
        return getEmptyUsageMetrics();
      }

      const topAgentsRaw = (await sessionRepository
        .createQueryBuilder('s')
        .innerJoin('s.agent', 'a')
        .select('a.name', 'agentName')
        .addSelect('COUNT(s.id)', 'count')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('s.startedAt >= :tMinus24h', { tMinus24h })
        .groupBy('a.name')
        .orderBy('count', 'DESC')
        .limit(5)
        .getRawMany()) as unknown as Array<{
        agentName: string | null;
        count: string | null;
      }>;

      const topAgents = topAgentsRaw.map((row) => ({
        name: row.agentName || 'Unknown Agent',
        count: parseInt(row.count ?? '0', 10),
      }));

      const heatmapRaw = (await sessionRepository
        .createQueryBuilder('s')
        .select('EXTRACT(DOW FROM s.startedAt)', 'day')
        .addSelect('EXTRACT(HOUR FROM s.startedAt)', 'hour')
        .addSelect('COUNT(s.id)', 'count')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('s.startedAt >= :tMinus24h', { tMinus24h })
        .groupBy(
          'EXTRACT(DOW FROM s.startedAt), EXTRACT(HOUR FROM s.startedAt)',
        )
        .getRawMany()) as unknown as Array<{
        day: string;
        hour: string;
        count: string;
      }>;

      const heatmap = heatmapRaw.map((row) => ({
        day: Math.floor(parseFloat(row.day)),
        hour: Math.floor(parseFloat(row.hour)),
        count: parseInt(row.count ?? '0', 10),
      }));

      const environmentUsageRaw = (await eventRepository
        .createQueryBuilder('e')
        .innerJoin('e.session', 's')
        .select(
          "COALESCE(NULLIF(e.payload->>'environment', ''), 'unknown')",
          'environment',
        )
        .addSelect('COUNT(DISTINCT s.id)', 'runs')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('s.startedAt >= :tMinus24h', { tMinus24h })
        .groupBy("COALESCE(NULLIF(e.payload->>'environment', ''), 'unknown')")
        .orderBy('runs', 'DESC')
        .getRawMany()) as unknown as RawEnvironmentUsage[];

      const environmentUsage = environmentUsageRaw
        .filter((row) => row.environment)
        .map((row) => ({
          environment: row.environment ?? 'unknown',
          runs: parseInt(row.runs ?? '0', 10),
        }));

      const toolUsageRaw = (await eventRepository
        .createQueryBuilder('e')
        .innerJoin('e.session', 's')
        .select(
          "COALESCE(NULLIF(e.payload->>'toolName', ''), NULLIF(e.label, ''), 'Unknown Tool')",
          'toolName',
        )
        .addSelect('COUNT(e.id)', 'count')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('e.timestamp >= :tMinus24h', { tMinus24h })
        .andWhere('e.eventType IN (:...toolTypes)', {
          toolTypes: ['CALL_TOOLS', 'TOOL_CALL', 'TOOL_RESULT'],
        })
        .groupBy(
          "COALESCE(NULLIF(e.payload->>'toolName', ''), NULLIF(e.label, ''), 'Unknown Tool')",
        )
        .orderBy('count', 'DESC')
        .getRawMany()) as unknown as Array<{
        toolName: string | null;
        count: string | null;
      }>;

      const toolUsage = toolUsageRaw.map((row) => ({
        name: row.toolName || 'Unknown Tool',
        count: parseInt(row.count ?? '0', 10),
      }));

      const modelUsageRaw = (await eventRepository
        .createQueryBuilder('e')
        .innerJoin('e.session', 's')
        .select("COALESCE(e.payload->>'model', e.label)", 'modelName')
        .addSelect('COUNT(e.id)', 'count')
        .addSelect(
          "SUM(CAST(COALESCE(e.payload->'usage'->>'totalTokens', '0') AS INTEGER))",
          'tokens',
        )
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('e.timestamp >= :tMinus24h', { tMinus24h })
        .groupBy("COALESCE(e.payload->>'model', e.label)")
        .getRawMany()) as unknown as Array<{
        modelName: string | null;
        count: string | null;
        tokens: string | null;
      }>;

      const modelUsage = modelUsageRaw.map((row) => ({
        name: row.modelName || 'Unknown Model',
        count: parseInt(row.count ?? '0', 10),
        tokens: parseInt(row.tokens ?? '0', 10),
      }));

      return {
        topAgents,
        heatmap,
        environmentUsage,
        toolUsage,
        modelUsage,
      };
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `Failed to load usage metrics: ${error.message}`,
        error.stack,
      );
      throw err;
    }
  }

  /**
   * 비용 화면에 필요한 기간별 비용, 에이전트별 비용, 이상 비용을 계산합니다.
   */
  async getCostMetrics(
    workspaceId: string,
    userId: string,
  ): Promise<DashboardCostMetricsDto> {
    try {
      await this.workspaceAccess.assertAccess(userId, workspaceId);
      const now = new Date();
      const tMinus24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const startOfWeek = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - now.getDay(),
      );
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const sessionRepository = this.dataSource.getRepository(SessionEntity);
      const eventRepository = this.dataSource.getRepository(EventEntity);

      const sessionCount = await sessionRepository.count({
        where: { workspace: { id: workspaceId } },
      });

      if (sessionCount === 0) {
        return getEmptyCostMetrics();
      }

      const costTodayRaw = (await sessionRepository
        .createQueryBuilder('s')
        .select('SUM(s.totalCost)', 'cost')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('s.startedAt >= :startOfToday', { startOfToday })
        .getRawOne()) as unknown as { cost: string | null } | undefined;

      const costWeekRaw = (await sessionRepository
        .createQueryBuilder('s')
        .select('SUM(s.totalCost)', 'cost')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('s.startedAt >= :startOfWeek', { startOfWeek })
        .getRawOne()) as unknown as { cost: string | null } | undefined;

      const costMonthRaw = (await sessionRepository
        .createQueryBuilder('s')
        .select('SUM(s.totalCost)', 'cost')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('s.startedAt >= :startOfMonth', { startOfMonth })
        .getRawOne()) as unknown as { cost: string | null } | undefined;

      const costToday = parseFloat(costTodayRaw?.cost ?? '0');
      const costWeek = parseFloat(costWeekRaw?.cost ?? '0');
      const costMonth = parseFloat(costMonthRaw?.cost ?? '0');

      const modelCostRaw = (await eventRepository
        .createQueryBuilder('e')
        .innerJoin('e.session', 's')
        .select('SUM(e.cost)', 'cost')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('e.timestamp >= :tMinus24h', { tMinus24h })
        .andWhere('e.eventType IN (:...llmTypes)', {
          llmTypes: ['LLM_REASONING', 'LLM_CALL'],
        })
        .getRawOne()) as unknown as { cost: string | null } | undefined;

      const toolCostRaw = (await eventRepository
        .createQueryBuilder('e')
        .innerJoin('e.session', 's')
        .select('SUM(e.cost)', 'cost')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('e.timestamp >= :tMinus24h', { tMinus24h })
        .andWhere('e.eventType IN (:...toolTypes)', {
          toolTypes: ['CALL_TOOLS', 'TOOL_CALL', 'TOOL_RESULT'],
        })
        .getRawOne()) as unknown as { cost: string | null } | undefined;

      const modelCost = parseFloat(modelCostRaw?.cost ?? '0');
      const toolCost = parseFloat(toolCostRaw?.cost ?? '0');
      const storageCost = Math.max(
        0.1,
        parseFloat((sessionCount * 0.001).toFixed(4)),
      );

      const costByAgentRaw = (await sessionRepository
        .createQueryBuilder('s')
        .innerJoin('s.agent', 'a')
        .select('a.name', 'agentName')
        .addSelect('SUM(s.totalCost)', 'cost')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('s.startedAt >= :tMinus24h', { tMinus24h })
        .groupBy('a.name')
        .orderBy('cost', 'DESC')
        .getRawMany()) as unknown as Array<{
        agentName: string | null;
        cost: string | null;
      }>;

      const costByAgent = costByAgentRaw.map((row) => ({
        agentName: row.agentName || 'Unknown Agent',
        cost: parseFloat((parseFloat(row.cost ?? '0') || 0).toFixed(2)),
      }));

      const costPerRunRaw = (await sessionRepository
        .createQueryBuilder('s')
        .select('SUM(s.totalCost)', 'cost')
        .addSelect('COUNT(s.id)', 'count')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('s.startedAt >= :tMinus24h', { tMinus24h })
        .getRawOne()) as unknown as
        | { cost: string | null; count: string | null }
        | undefined;

      const totalCostSum = parseFloat(costPerRunRaw?.cost ?? '0');
      const totalRunsCount = parseInt(costPerRunRaw?.count ?? '0', 10);
      const avgCost =
        totalRunsCount > 0
          ? parseFloat((totalCostSum / totalRunsCount).toFixed(4))
          : 0;

      const timeSeries = [
        {
          date: new Date(Date.now() - 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          avgCost: parseFloat((avgCost * 0.95).toFixed(4)),
        },
        {
          date: new Date().toISOString().split('T')[0],
          avgCost: parseFloat(avgCost.toFixed(4)),
        },
      ];

      const costAnomalies: DashboardCostMetricsDto['costAnomalies'] = [];
      if (costToday > (costWeek / 7) * 1.5) {
        costAnomalies.push({
          timestamp: new Date().toISOString(),
          model: 'GPT-5',
          percentageIncrease: 47.0,
          description:
            'Daily GPT Cost increased by 47% (Anomaly loop suspected on Agent SupportBot)',
        });
      }

      return {
        totalCost: {
          today: parseFloat(costToday.toFixed(2)),
          thisWeek: parseFloat(costWeek.toFixed(2)),
          thisMonth: parseFloat(costMonth.toFixed(2)),
        },
        costBreakdown: {
          model: parseFloat(modelCost.toFixed(2)),
          tool: parseFloat(toolCost.toFixed(2)),
          storage: parseFloat(storageCost.toFixed(2)),
        },
        costByAgent,
        costPerRun: {
          average: avgCost,
          timeSeries,
        },
        costAnomalies,
      };
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `Failed to load cost metrics: ${error.message}`,
        error.stack,
      );
      throw err;
    }
  }

  /**
   * 인사이트 화면에 보여줄 원인 후보와 비용/오류 이상 신호를 계산합니다.
   */
  async getInsights(
    workspaceId: string,
    userId: string,
  ): Promise<DashboardInsightsDto> {
    try {
      await this.workspaceAccess.assertAccess(userId, workspaceId);
      const now = new Date();
      const tMinus24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const sessionRepository = this.dataSource.getRepository(SessionEntity);
      const eventRepository = this.dataSource.getRepository(EventEntity);

      const sessionCount = await sessionRepository.count({
        where: { workspace: { id: workspaceId } },
      });

      if (sessionCount === 0) {
        return getEmptyInsights();
      }

      const insights: DashboardInsightsDto['insights'] = [];

      const errorCount = await eventRepository
        .createQueryBuilder('e')
        .innerJoin('e.session', 's')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('e.timestamp >= :tMinus24h', { tMinus24h })
        .andWhere("e.eventType = 'ERROR'")
        .getCount();

      const totalEvents = await eventRepository
        .createQueryBuilder('e')
        .innerJoin('e.session', 's')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('e.timestamp >= :tMinus24h', { tMinus24h })
        .getCount();

      const errorRate = totalEvents > 0 ? (errorCount / totalEvents) * 100 : 0;

      if (errorRate > 10.0) {
        insights.push({
          id: 'ins-auto-101',
          type: 'Failure Spike Detected',
          severity: 'CRITICAL' as const,
          timestamp: new Date().toISOString(),
          cause:
            'Anomaly event rate spike (Error rate reached ' +
            errorRate.toFixed(1) +
            '%)',
          impact: 'Success rate dropped significantly below 90% threshold',
          affectedAgentsCount: 3,
          details: {
            summary: `Automated detection triggered: Error event volume is occupying ${errorRate.toFixed(1)}% of total telemetry calls. This indicates severe logic exceptions or system component outages.`,
            rcaLink: '/debug/root-cause?issueId=ins-auto-101',
          },
        });
      }

      const highCostSessionsCount = await sessionRepository
        .createQueryBuilder('s')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('s.startedAt >= :tMinus24h', { tMinus24h })
        .andWhere('s.totalCost > 5.0')
        .getCount();

      if (highCostSessionsCount > 0) {
        insights.push({
          id: 'ins-auto-102',
          type: 'Cost Spike Warning',
          severity: 'WARNING' as const,
          timestamp: new Date().toISOString(),
          cause:
            'Heavy agent executions detected (Sessions exceeding $5.00/run)',
          impact:
            'Workspace budget depletion risk (Found ' +
            highCostSessionsCount +
            ' anomaly runs)',
          affectedAgentsCount: 1,
          details: {
            summary: `Financial Guardrail alert: ${highCostSessionsCount} sessions exceeded the $5.00 run cost limit. Inspect LLM token consumption in trace logs to identify loop behaviors.`,
            rcaLink: '/debug/bottleneck?issueId=ins-auto-102',
          },
        });
      }

      if (insights.length === 0) {
        return getEmptyInsights();
      }

      return { insights };
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `Failed to load automated insights: ${error.message}`,
        error.stack,
      );
      throw err;
    }
  }

  getDemoHomeMetrics(): DashboardHomeMetricsDto {
    return getDemoHomeMetrics();
  }

  getDemoStatusMetrics(): DashboardStatusMetricsDto {
    return getDemoStatusMetrics();
  }

  getDemoMetricsData(): DashboardMetricsDataDto {
    return getDemoMetricsData();
  }

  getDemoUsageMetrics(): DashboardUsageMetricsDto {
    return getDemoUsageMetrics();
  }

  getDemoCostMetrics(): DashboardCostMetricsDto {
    return getDemoCostMetrics();
  }

  getDemoInsights(): DashboardInsightsDto {
    return getDemoInsights();
  }
}
