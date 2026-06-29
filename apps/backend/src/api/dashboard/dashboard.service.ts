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

// 타입 안정성을 위한 데이터베이스 로우 타입 정의
interface RawKpiMetrics {
  runs?: string;
  cost?: string;
  activeAgents?: string;
  completedRuns?: string;
  tokens?: string;
}

interface RawLatencyMetrics {
  avg?: string;
}

interface RawAgentHealth {
  agentId: string;
  agentName: string;
  totalRuns: string;
  failedRuns: string;
}

interface RawTimeSeries {
  hour: string;
  count?: string;
  failed?: string;
}

interface RawModelMetrics {
  modelName: string | null;
  totalCalls: string;
  errorCalls: string;
  avgLatency: string | null;
}

interface RawToolMetrics {
  toolName: string | null;
  totalCalls: string;
  errorCalls: string;
}

interface RawPercentiles {
  p50: string | null;
  p95: string | null;
  p99: string | null;
}

interface RawTokenMetrics {
  input: string | null;
  output: string | null;
}

interface RawAgentComparison {
  agentName: string | null;
  completed: string;
  total: string;
  cost: string | null;
  p95Latency?: string | null;
}

interface RawRecentIssue {
  id: string;
  agentName: string | null;
  issueType: string | null;
  severity: 'CRITICAL' | 'WARNING';
  occurrenceCount: string;
  affectedSessionsCount: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

interface RawEnvironmentUsage {
  environment: string | null;
  runs: string;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  /**
   * 대시보드 홈(요약) 화면에 필요한 지표 데이터를 가져옵니다.
   * 데이터베이스에 데이터가 존재할 경우 실제 통계를 집계하고,
   * 데이터가 충분하지 않을 경우 데모 목적의 기본 풍부한 모의(Mock) 데이터를 반환합니다.
   * 모든 API 응답 키와 필드 메시지는 영어로 작성됩니다.
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
        .select('COUNT(s.id)', 'runs')
        .addSelect('SUM(s.totalCost)', 'cost')
        .addSelect('COUNT(DISTINCT s.agentId)', 'activeAgents')
        .addSelect(
          "SUM(CASE WHEN s.status = 'COMPLETED' THEN 1 ELSE 0 END)",
          'completedRuns',
        )
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('s.startedAt >= :tMinus24h', { tMinus24h })
        .getRawOne()) as unknown as RawKpiMetrics | undefined;

      const totalRuns = parseInt(currentRaw?.runs ?? '0', 10);

      // 데이터가 없을 경우 데모 모드로 전환
      if (totalRuns === 0) {
        return this.getEmptyHomeMetrics();
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
        .select('a.id', 'agentId')
        .addSelect('a.name', 'agentName')
        .addSelect('COUNT(s.id)', 'totalRuns')
        .addSelect(
          "SUM(CASE WHEN s.status = 'FAILED' THEN 1 ELSE 0 END)",
          'failedRuns',
        )
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('s.startedAt >= :tMinus24h', { tMinus24h })
        .groupBy('a.id, a.name')
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
        .select('MIN(e.id)', 'id')
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
   * 대시보드 상태(Status) 화면에 필요한 지표 데이터를 가져옵니다.
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
        return this.getEmptyStatusMetrics();
      }

      const agentSessionsRaw = (await sessionRepository
        .createQueryBuilder('s')
        .innerJoin('s.agent', 'a')
        .select('a.id', 'agentId')
        .addSelect(
          "SUM(CASE WHEN s.status = 'FAILED' THEN 1 ELSE 0 END)",
          'failedRuns',
        )
        .addSelect('COUNT(s.id)', 'totalRuns')
        .where('s.workspaceId = :workspaceId', { workspaceId })
        .andWhere('s.startedAt >= :tMinus24h', { tMinus24h })
        .groupBy('a.id')
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
   * 대시보드 옵저버빌리티 지표(Metrics) 화면에 필요한 통계 데이터를 가져옵니다.
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
        return this.getEmptyMetricsData();
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
   * 대시보드 사용 현황(Usage) 화면에 필요한 지표 데이터를 가져옵니다.
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
        return this.getEmptyUsageMetrics();
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
   * 대시보드 비용(Cost) 화면에 필요한 지표 데이터를 가져옵니다.
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
        return this.getEmptyCostMetrics();
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
   * 대시보드 인사이트(Insights) 화면에 필요한 데이터를 가져옵니다.
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
        return this.getEmptyInsights();
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
        return this.getEmptyInsights();
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

  private getEmptyHomeMetrics(): DashboardHomeMetricsDto {
    return {
      kpis: {
        agentRuns: { value: 0, change: 0, trend: 'up' },
        successRate: { value: 0, change: 0, trend: 'up' },
        avgLatency: { value: 0, change: 0, trend: 'up' },
        cost: { value: 0, change: 0, trend: 'up' },
        activeAgents: { value: 0 },
        criticalAlerts: { value: 0, change: 0, trend: 'up' },
      },
      healthScores: [],
      runVolume: [],
      failureTrend: [],
      recentIssues: [],
    };
  }

  private getEmptyStatusMetrics(): DashboardStatusMetricsDto {
    return {
      agentStatus: {
        healthy: 0,
        warning: 0,
        critical: 0,
        offline: 0,
      },
      modelStatus: [],
      toolStatus: [],
      recentOutages: [],
      slo: {
        metricName: 'Success Rate',
        target: 95,
        current: 0,
        status: 'NON_COMPLIANT',
      },
    };
  }

  private getEmptyMetricsData(): DashboardMetricsDataDto {
    return {
      runMetrics: {
        runsPerSec: 0,
        tokensPerSec: 0,
        requestsPerSec: 0,
      },
      latencyDistribution: {
        p50: 0,
        p95: 0,
        p99: 0,
      },
      tokenMetrics: {
        inputTokens: 0,
        outputTokens: 0,
      },
      errorRate: {
        toolError: 0,
        llmError: 0,
        validationError: 0,
      },
      agentComparison: [],
    };
  }

  private getEmptyUsageMetrics(): DashboardUsageMetricsDto {
    return {
      topAgents: [],
      heatmap: [],
      environmentUsage: [],
      toolUsage: [],
      modelUsage: [],
    };
  }

  private getEmptyCostMetrics(): DashboardCostMetricsDto {
    return {
      totalCost: {
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
      },
      costBreakdown: {
        model: 0,
        tool: 0,
        storage: 0,
      },
      costByAgent: [],
      costPerRun: {
        average: 0,
        timeSeries: [],
      },
      costAnomalies: [],
    };
  }

  private getEmptyInsights(): DashboardInsightsDto {
    return {
      insights: [],
    };
  }

  getDemoHomeMetrics(): DashboardHomeMetricsDto {
    const agentNames = [
      'ResearchBot',
      'SupportBot',
      'SalesOps Agent',
      'InvoiceBot',
      'PolicyReview Agent',
      'DataOps Agent',
      'ComplianceBot',
      'CustomerSuccess Agent',
      'Retriever Agent',
      'IncidentTriage Agent',
      'BillingBot',
      'Onboarding Agent',
      'SearchQA Agent',
      'EscalationBot',
      'KnowledgeSync Agent',
      'WorkflowPlanner',
    ];
    const issues = [
      ['Slack API Timeout', 'ResearchBot', 'CRITICAL', 214, 386],
      [
        'Tool retry loop detected',
        'IncidentTriage Agent',
        'CRITICAL',
        168,
        244,
      ],
      ['Prompt injection attempt blocked', 'SupportBot', 'CRITICAL', 142, 198],
      ['CRM enrichment latency spike', 'SalesOps Agent', 'WARNING', 126, 176],
      ['Context window truncation', 'Retriever Agent', 'WARNING', 118, 141],
      ['Payment data access denied', 'ComplianceBot', 'CRITICAL', 86, 112],
      ['Memory miss rate increased', 'KnowledgeSync Agent', 'WARNING', 74, 98],
      [
        'Policy approval queue backlog',
        'PolicyReview Agent',
        'WARNING',
        69,
        83,
      ],
      ['Database read timeout', 'DataOps Agent', 'CRITICAL', 58, 71],
      ['Model fallback activated', 'CustomerSuccess Agent', 'WARNING', 43, 52],
    ] as const;
    const hours = Array.from({ length: 72 }).map((_, i) => {
      const d = new Date();
      d.setHours(d.getHours() - (71 - i));
      d.setMinutes(0, 0, 0);
      return d.toISOString();
    });

    return {
      kpis: {
        agentRuns: { value: 428640, change: 18.7, trend: 'up' as const },
        successRate: { value: 96.8, change: -1.1, trend: 'down' as const },
        avgLatency: { value: 2.84, change: 0.42, trend: 'up' as const },
        cost: { value: 12842.72, change: 16.4, trend: 'up' as const },
        activeAgents: { value: 184 },
        criticalAlerts: { value: 37, change: 12, trend: 'up' as const },
      },
      healthScores: agentNames.map((agentName, index) => {
        const score = Math.max(52, 99 - index * 3 - (index % 4) * 4);
        return {
          agentId: `demo-agent-${index + 1}`,
          agentName,
          score,
          status:
            score >= 90
              ? ('HEALTHY' as const)
              : score >= 75
                ? ('WARNING' as const)
                : ('CRITICAL' as const),
        };
      }),
      runVolume: hours.map((hour, idx) => {
        const eventHour = new Date(hour).getHours();
        const businessHourBoost =
          eventHour >= 8 && eventHour <= 20 ? 2800 : 850;
        const dailyWave = Math.max(0, Math.sin(idx / 5)) * 1450;
        const incidentSpike = idx >= 58 && idx <= 66 ? 1800 : 0;
        const count = Math.floor(
          4200 + businessHourBoost + dailyWave + incidentSpike,
        );
        const failureRatio =
          idx >= 58 && idx <= 66
            ? 0.082 + (idx - 58) * 0.004
            : 0.024 + (idx % 7) * 0.002;
        const failedCount = Math.floor(count * failureRatio);
        const successCount = count - failedCount;

        return {
          time: hour,
          count: successCount + failedCount,
          successCount,
          failedCount,
        };
      }),
      failureTrend: hours.map((hour, idx) => {
        const incident = idx >= 58 && idx <= 66;
        const rate = incident
          ? 8.2 + (idx - 58) * 0.7
          : 2.1 + Math.max(0, Math.sin(idx / 6)) * 1.4;
        const previousRate = incident
          ? 3.1 + (idx - 58) * 0.15
          : 1.8 + Math.max(0, Math.cos(idx / 7)) * 1.1;

        return {
          time: hour,
          rate: parseFloat(rate.toFixed(2)),
          previousRate: parseFloat(previousRate.toFixed(2)),
        };
      }),
      recentIssues: issues.map(
        (
          [
            issueType,
            agentName,
            severity,
            occurrenceCount,
            affectedSessionsCount,
          ],
          index,
        ) => ({
          id: `demo-issue-${index + 1}`,
          agentName,
          issueType,
          severity,
          timestamp: new Date(
            Date.now() - (index * 11 + 6) * 60 * 1000,
          ).toISOString(),
          occurrenceCount,
          affectedSessionsCount,
          lastSeenAt: new Date(
            Date.now() - (index * 7 + 3) * 60 * 1000,
          ).toISOString(),
        }),
      ),
    };
  }

  private getDefaultModelStatus() {
    return [
      { model: 'GPT-5', successRate: 99.4, avgLatency: 3.1 },
      { model: 'Claude Sonnet', successRate: 96.2, avgLatency: 2.8 },
      { model: 'Gemini', successRate: 98.1, avgLatency: 1.9 },
    ];
  }

  private getDefaultToolStatus() {
    return [
      { tool: 'Notion', successRate: 99.1 },
      { tool: 'Slack', successRate: 94.5 },
      { tool: 'CRM', successRate: 98.0 },
      { tool: 'Database', successRate: 100.0 },
    ];
  }

  getDemoStatusMetrics(): DashboardStatusMetricsDto {
    return {
      agentStatus: {
        healthy: 12,
        warning: 4,
        critical: 2,
        offline: 0,
      },
      modelStatus: this.getDefaultModelStatus(),
      toolStatus: this.getDefaultToolStatus(),
      recentOutages: [
        {
          timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
          component: 'Slack API Integration',
          error: 'Slack API Timeout (504 Gateway Timeout)',
        },
        {
          timestamp: new Date(Date.now() - 37 * 60 * 1000).toISOString(),
          component: 'GPT-5 Model',
          error: 'Context Overflow (Token Limit Exceeded)',
        },
      ],
      slo: {
        metricName: 'Success Rate',
        target: 95.0,
        current: 96.2,
        status: 'COMPLIANT' as const,
      },
    };
  }

  private getDefaultAgentComparison() {
    return [
      {
        agentName: 'SupportBot',
        successRate: 98.2,
        p95Latency: 2.5,
        cost: 42.1,
      },
      { agentName: 'SalesBot', successRate: 92.4, p95Latency: 5.8, cost: 76.5 },
    ];
  }

  getDemoMetricsData(): DashboardMetricsDataDto {
    return {
      runMetrics: {
        runsPerSec: 15.4,
        tokensPerSec: 84200,
        requestsPerSec: 32.1,
      },
      latencyDistribution: {
        p50: 1.8,
        p95: 4.5,
        p99: 9.2,
      },
      tokenMetrics: {
        inputTokens: 48200100,
        outputTokens: 12840900,
      },
      errorRate: {
        toolError: 42,
        llmError: 18,
        validationError: 5,
      },
      agentComparison: this.getDefaultAgentComparison(),
    };
  }

  private getDefaultTopAgents() {
    return [
      { name: 'Customer Support', count: 6420 },
      { name: 'Sales Agent', count: 3120 },
      { name: 'Research Agent', count: 1890 },
    ];
  }

  private getDefaultToolUsage() {
    return [
      { name: 'Slack', count: 12800 },
      { name: 'Notion', count: 4820 },
      { name: 'Google Drive', count: 2100 },
    ];
  }

  private getDefaultModelUsage() {
    return [
      { name: 'GPT-5', count: 15400, tokens: 84200000 },
      { name: 'Claude', count: 8900, tokens: 32100000 },
      { name: 'Gemini', count: 4200, tokens: 1540000 },
    ];
  }

  getDemoUsageMetrics(): DashboardUsageMetricsDto {
    const heatmap: Array<{ day: number; hour: number; count: number }> = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const weight = hour >= 9 && hour <= 18 ? 5.0 : 1.0;
        heatmap.push({
          day,
          hour,
          count: Math.floor(Math.random() * 50 * weight),
        });
      }
    }

    return {
      topAgents: this.getDefaultTopAgents(),
      heatmap,
      environmentUsage: [
        { environment: 'production', runs: 520 },
        { environment: 'staging', runs: 190 },
        { environment: 'preview', runs: 60 },
      ],
      toolUsage: this.getDefaultToolUsage(),
      modelUsage: this.getDefaultModelUsage(),
    };
  }

  private getDefaultCostByAgent() {
    return [
      { agentName: 'SupportBot', cost: 34.0 },
      { agentName: 'ResearchBot', cost: 82.0 },
    ];
  }

  private getDefaultCostAnomalies() {
    return [
      {
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        model: 'GPT-5',
        percentageIncrease: 47.0,
        description:
          'Today GPT cost increased by 47% (Potential massive retry loop detected)',
      },
    ];
  }

  getDemoCostMetrics(): DashboardCostMetricsDto {
    return {
      totalCost: {
        today: 127.42,
        thisWeek: 842.1,
        thisMonth: 3240.5,
      },
      costBreakdown: {
        model: 84.22,
        tool: 32.1,
        storage: 11.1,
      },
      costByAgent: this.getDefaultCostByAgent(),
      costPerRun: {
        average: 0.0125,
        timeSeries: [
          {
            date: new Date(Date.now() - 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0],
            avgCost: 0.012,
          },
          { date: new Date().toISOString().split('T')[0], avgCost: 0.0125 },
        ],
      },
      costAnomalies: this.getDefaultCostAnomalies(),
    };
  }

  getDemoInsights(): DashboardInsightsDto {
    return {
      insights: [
        {
          id: 'ins-901',
          type: 'Failure Spike Detected',
          severity: 'CRITICAL' as const,
          timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          cause: 'After deployment of Prompt v23',
          impact: 'Success rate collapsed from 96% to 82%',
          affectedAgentsCount: 5,
          details: {
            summary:
              'SalesBot and 4 other agents experienced successive Intent Misclassification and validation errors immediately following the deployment of Prompt version v23.',
            rcaLink: '/debug/root-cause?issueId=ins-901',
          },
        },
        {
          id: 'ins-902',
          type: 'Cost Spike Warning',
          severity: 'WARNING' as const,
          timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          cause: 'Google Drive Tool Infinite Loop',
          impact:
            'Average agent execution cost increased from $0.012 to $0.085',
          affectedAgentsCount: 2,
          details: {
            summary:
              'Missing retry backoff parameters caused an infinite loop in file search API invocations during Google Drive connection timeouts.',
            rcaLink: '/debug/bottleneck?issueId=ins-902',
          },
        },
      ],
    };
  }
}
