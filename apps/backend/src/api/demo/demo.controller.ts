import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  DashboardCostMetricsDto,
  DashboardHomeMetricsDto,
  DashboardInsightsDto,
  DashboardMetricsDataDto,
  DashboardStatusMetricsDto,
  DashboardUsageMetricsDto,
  DebugBottleneckResponseDto,
  DebugEventLogResponseDto,
  DebugErrorGroupListResponseDto,
  DebugFailurePatternResponseDto,
  DebugLatencyResponseDto,
  DebugLlmCallListResponseDto,
  DebugMemoryResponseDto,
  DebugPolicySimulationRequestDto,
  DebugPolicySimulationResponseDto,
  DebugReproduceRequestDto,
  DebugReproduceResponseDto,
  DebugRootCauseResponseDto,
  DebugSessionListResponseDto,
  DebugTimelineResponseDto,
  DebugToolCallListResponseDto,
  OrganizationDetailDto,
  OrganizationSummaryDto,
  WorkspaceDetailDto,
  WorkspaceSummaryDto,
} from '@repo/dto';
import { DashboardService } from '../dashboard/dashboard.service';

const DEMO_ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const DEMO_PRODUCTION_WORKSPACE_ID = '00000000-0000-4000-8000-000000000101';
const DEMO_STAGING_WORKSPACE_ID = '00000000-0000-4000-8000-000000000102';
const DEMO_OWNER_USER_ID = '00000000-0000-4000-8000-000000000201';
const DEMO_ENGINEER_USER_ID = '00000000-0000-4000-8000-000000000202';

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

  @Get('organizations')
  getOrganizations(): OrganizationSummaryDto[] {
    this.assertDemoEnabled();
    return [
      {
        id: DEMO_ORGANIZATION_ID,
        name: 'Lynx Demo Organization',
        role: 'OWNER',
        workspaceCount: 2,
      },
    ];
  }

  @Get('organizations/:organizationId')
  getOrganization(
    @Param('organizationId') organizationId: string,
  ): OrganizationDetailDto {
    this.assertDemoEnabled();
    return {
      id: organizationId,
      name: 'Lynx Demo Organization',
      role: 'OWNER',
      members: [
        {
          userId: DEMO_OWNER_USER_ID,
          email: 'owner@lynx-demo.dev',
          name: 'Demo Owner',
          role: 'OWNER',
          joinedAt: new Date(
            Date.now() - 21 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
        {
          userId: DEMO_ENGINEER_USER_ID,
          email: 'engineer@lynx-demo.dev',
          name: 'Demo Engineer',
          role: 'ADMIN',
          joinedAt: new Date(
            Date.now() - 10 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
      ],
      workspaces: [
        { id: DEMO_PRODUCTION_WORKSPACE_ID, name: 'Production', plan: 'PRO' },
        { id: DEMO_STAGING_WORKSPACE_ID, name: 'Staging', plan: 'FREE' },
      ],
    };
  }

  @Get('workspaces')
  getWorkspaces(): WorkspaceSummaryDto[] {
    this.assertDemoEnabled();
    return [
      {
        id: DEMO_PRODUCTION_WORKSPACE_ID,
        name: 'Production',
        plan: 'PRO',
        organization: {
          id: DEMO_ORGANIZATION_ID,
          name: 'Lynx Demo Organization',
        },
      },
      {
        id: DEMO_STAGING_WORKSPACE_ID,
        name: 'Staging',
        plan: 'FREE',
        organization: {
          id: DEMO_ORGANIZATION_ID,
          name: 'Lynx Demo Organization',
        },
      },
    ];
  }

  @Get('workspaces/:workspaceId')
  getWorkspace(@Param('workspaceId') workspaceId: string): WorkspaceDetailDto {
    this.assertDemoEnabled();
    return {
      id: workspaceId,
      name:
        workspaceId === DEMO_STAGING_WORKSPACE_ID ? 'Staging' : 'Production',
      plan: workspaceId === DEMO_STAGING_WORKSPACE_ID ? 'FREE' : 'PRO',
      organization: {
        id: DEMO_ORGANIZATION_ID,
        name: 'Lynx Demo Organization',
      },
      apiKey: 'lynx_demo_********************************',
    };
  }

  @Get('debug/sessions')
  getDebugSessions(): DebugSessionListResponseDto {
    this.assertDemoEnabled();
    return {
      sessions: [
        {
          id: 'demo-session-research-1',
          runId: 'research-run-1042',
          agentId: 'demo-agent-research',
          agentName: 'ResearchBot',
          userId: DEMO_OWNER_USER_ID,
          status: 'FAILED',
          severity: 'CRITICAL',
          startedAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
          endedAt: new Date(Date.now() - 39 * 60 * 1000).toISOString(),
          durationMs: 180000,
          issueCount: 2,
          primaryIssue: 'TOOL_FAILURE',
          totalTokens: 12480,
          totalCost: 0.184,
        },
        {
          id: 'demo-session-support-1',
          runId: 'support-run-883',
          agentId: 'demo-agent-support',
          agentName: 'SupportBot',
          userId: DEMO_ENGINEER_USER_ID,
          status: 'COMPLETED',
          severity: 'WARNING',
          startedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
          endedAt: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
          durationMs: 120000,
          issueCount: 1,
          primaryIssue: 'HIGH_LATENCY',
          totalTokens: 8420,
          totalCost: 0.092,
        },
      ],
      page: { hasMore: false },
    };
  }

  @Get('debug/sessions/:sessionId/events')
  getDebugSessionEvents(
    @Param('sessionId') sessionId: string,
  ): DebugEventLogResponseDto {
    this.assertDemoEnabled();
    return {
      events: [
        {
          id: 'demo-event-1',
          sessionId,
          runId: 'research-run-1042',
          agentName: 'ResearchBot',
          eventType: 'LLM_CALL',
          label: 'Plan research task',
          phase: 'single',
          timestamp: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
          latency: 1820,
          cost: 0.048,
          model: 'gpt-5',
          severity: 'INFO',
          inputPreview: 'Summarize recent customer feedback.',
          outputPreview: 'Need to collect Slack and CRM context.',
        },
        {
          id: 'demo-event-2',
          sessionId,
          runId: 'research-run-1042',
          agentName: 'ResearchBot',
          eventType: 'TOOL_RESULT',
          label: 'Slack API Timeout',
          phase: 'error',
          timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
          latency: 12000,
          cost: 0,
          toolName: 'Slack',
          severity: 'CRITICAL',
          error: 'Slack API returned 504 Gateway Timeout.',
          inputPreview: '{"channel":"customer-feedback"}',
        },
      ],
      page: { hasMore: false },
    };
  }

  @Get('debug/logs')
  getDebugLogs(): DebugEventLogResponseDto {
    this.assertDemoEnabled();
    return this.getDebugSessionEvents('demo-session-research-1');
  }

  @Get('debug/tool-calls')
  getDebugToolCalls(): DebugToolCallListResponseDto {
    this.assertDemoEnabled();
    return {
      toolCalls: this.getDebugSessionEvents('demo-session-research-1')
        .events.filter((event) => event.eventType === 'TOOL_RESULT')
        .map((event) => ({
          ...event,
          toolName: event.toolName ?? 'Slack',
          status: event.error ? 'timeout' : 'success',
          retryCount: event.error ? 3 : 0,
          sideEffect: false,
          riskCategory: 'read-only',
          argumentsPreview: event.inputPreview,
          resultPreview: event.outputPreview,
        })),
      page: { hasMore: false },
    };
  }

  @Get('debug/llm-io')
  getDebugLlmCalls(): DebugLlmCallListResponseDto {
    this.assertDemoEnabled();
    return {
      llmCalls: this.getDebugSessionEvents('demo-session-research-1')
        .events.filter((event) => event.eventType === 'LLM_CALL')
        .map((event) => ({
          ...event,
          provider: 'OpenAI',
          model: event.model ?? 'gpt-5',
          promptVersion: 'prompt-v3',
          temperature: 0.2,
          maxTokens: 1200,
          finishReason: 'stop',
          totalTokens: 2480,
          requestedToolCall: true,
          refused: false,
          requestPreview: event.inputPreview,
          responsePreview: event.outputPreview,
        })),
      page: { hasMore: false },
    };
  }

  @Get('debug/errors')
  getDebugErrors(): DebugErrorGroupListResponseDto {
    this.assertDemoEnabled();
    return {
      errors: [
        {
          fingerprint: 'demo-slack-timeout',
          title: 'Slack API Timeout',
          errorType: 'TOOL_FAILURE',
          severity: 'CRITICAL',
          occurrenceCount: 31,
          affectedSessions: 24,
          affectedAgents: ['ResearchBot', 'SupportBot'],
          firstSeenAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          lastSeenAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          representativeEventId: 'demo-event-2',
          representativeSessionId: 'demo-session-research-1',
          representativeMessage: 'Slack API returned 504 Gateway Timeout.',
          relatedTool: 'Slack',
          status: 'open',
        },
      ],
      page: { hasMore: false, total: 1 },
    };
  }

  @Get('debug/sessions/:sessionId/timeline')
  getDebugTimeline(): DebugTimelineResponseDto {
    this.assertDemoEnabled();
    const now = Date.now();
    return {
      session: this.getDebugSessions().sessions[0],
      nodes: [
        {
          id: 'demo-event-1',
          eventId: 'demo-event-1',
          eventType: 'LLM_CALL',
          label: 'Plan research task',
          phase: 'single',
          timestamp: new Date(now - 42 * 60 * 1000).toISOString(),
          spanId: 'span-root',
          depth: 0,
          latency: 1820,
          cost: 0.048,
          severity: 'INFO',
          model: 'gpt-5',
          summary: 'Agent planned a Slack-backed research flow.',
        },
        {
          id: 'demo-event-2',
          eventId: 'demo-event-2',
          eventType: 'TOOL_RESULT',
          label: 'Slack API Timeout',
          phase: 'error',
          timestamp: new Date(now - 40 * 60 * 1000).toISOString(),
          spanId: 'span-slack',
          parentSpanId: 'span-root',
          depth: 1,
          latency: 12000,
          severity: 'CRITICAL',
          toolName: 'Slack',
          summary: 'Slack API timed out after repeated retries.',
          error: '504 Gateway Timeout',
        },
      ],
      criticalPath: ['demo-event-1', 'demo-event-2'],
      criticalPathMethod: 'MAX_ACCUMULATED_LATENCY',
      highlightedEventId: 'demo-event-2',
    };
  }

  @Get('debug/sessions/:sessionId/root-cause')
  getDebugRootCause(
    @Param('sessionId') sessionId: string,
  ): DebugRootCauseResponseDto {
    this.assertDemoEnabled();
    return {
      sessionId,
      summary: 'Slack API timeout caused ResearchBot to fail the run.',
      candidates: [
        {
          id: 'candidate-1',
          title: 'Slack API Timeout',
          category: 'TOOL',
          confidence: 0.91,
          severity: 'CRITICAL',
          explanation:
            'The first critical event is a Slack tool result with a 504 timeout after retry.',
          firstBadEventId: 'demo-event-2',
          evidence: [
            {
              eventId: 'demo-event-2',
              eventType: 'TOOL_RESULT',
              label: 'Slack API Timeout',
              timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
              summary: 'Tool response timed out.',
              weight: 0.91,
            },
          ],
        },
      ],
      primaryCandidateId: 'candidate-1',
      confidence: 0.91,
      analysisMethod: 'HEURISTIC_V1',
      recommendedActions: [
        {
          title: 'Add Slack retry backoff',
          description:
            'Increase timeout tolerance and add exponential backoff for Slack reads.',
          target: 'TOOL',
          priority: 'HIGH',
        },
      ],
    };
  }

  @Get('debug/sessions/:sessionId/memory')
  getDebugMemory(
    @Param('sessionId') sessionId: string,
  ): DebugMemoryResponseDto {
    this.assertDemoEnabled();
    return {
      accesses: [
        {
          eventId: 'demo-memory-1',
          sessionId,
          operation: 'retrieve',
          key: 'customer-feedback-summary',
          hit: false,
          stale: false,
          timestamp: new Date(Date.now() - 41 * 60 * 1000).toISOString(),
          summary: 'No cached feedback summary found.',
        },
      ],
      hitCount: 0,
      missCount: 1,
      staleMemoryCount: 0,
      memoryMissCount: 1,
      unknownCount: 0,
    };
  }

  @Get('debug/patterns')
  getDebugPatterns(): DebugFailurePatternResponseDto {
    this.assertDemoEnabled();
    return {
      patterns: [
        {
          id: 'TOOL_RESULT|slack_api_timeout|Slack|no-model',
          name: 'Slack API Timeout',
          severity: 'CRITICAL',
          occurrenceCount: 31,
          affectedAgents: ['ResearchBot', 'SupportBot'],
          firstSeenAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          lastSeenAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          signature: {
            eventTypes: ['TOOL_RESULT'],
            labels: ['Slack API Timeout'],
            toolName: 'Slack',
          },
          signatureVersion: 'SIGNATURE_V1',
          exampleSessionId: 'demo-session-research-1',
        },
      ],
    };
  }

  @Get('debug/bottlenecks')
  getDebugBottlenecks(): DebugBottleneckResponseDto {
    this.assertDemoEnabled();
    return {
      bottlenecks: [
        {
          id: 'TOOL:Slack',
          type: 'TOOL',
          label: 'Slack',
          count: 42,
          avgLatency: 4800,
          p95Latency: 12000,
          totalCost: 0,
          affectedSessions: 18,
          trend: 'up',
        },
      ],
    };
  }

  @Get('debug/latency')
  getDebugLatency(): DebugLatencyResponseDto {
    this.assertDemoEnabled();
    return {
      summary: {
        avgLatency: 1860,
        p50: 920,
        p95: 6200,
        p99: 12000,
        slowEventCount: 14,
      },
      buckets: [
        {
          bucket: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          count: 82,
          p50: 720,
          p95: 4200,
          p99: 9000,
        },
        {
          bucket: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          count: 96,
          p50: 940,
          p95: 6200,
          p99: 12000,
        },
      ],
    };
  }

  @Post('debug/sessions/:sessionId/reproduce')
  reproduceDebugSession(
    @Param('sessionId') sessionId: string,
    @Body() body: DebugReproduceRequestDto,
  ): DebugReproduceResponseDto {
    this.assertDemoEnabled();
    return {
      replayId: `demo-replay-${sessionId}`,
      sourceSessionId: sessionId,
      mode: body.mode ?? 'DRY_RUN',
      status: 'READY',
      reproducible: true,
      deterministicScore: 0.67,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      steps: [
        {
          sourceEventId: 'demo-event-1',
          eventType: 'LLM_CALL',
          label: 'Plan research task',
          status: 'MATCHED',
          order: 1,
          replayable: true,
          expectedPreview: 'Need to collect Slack and CRM context.',
        },
        {
          sourceEventId: 'demo-event-2',
          eventType: 'TOOL_RESULT',
          label: 'Slack API Timeout',
          status: 'SKIPPED',
          order: 2,
          replayable: false,
          reason: 'External Slack state is not replayed in demo mode.',
        },
      ],
      summary: 'Demo replay plan is ready.',
    };
  }

  @Post('debug/sessions/:sessionId/policy/simulate')
  simulateDebugPolicy(
    @Body() body: DebugPolicySimulationRequestDto,
  ): DebugPolicySimulationResponseDto {
    this.assertDemoEnabled();
    return {
      allow: true,
      toolName: body.toolName,
      result: 'ALLOW',
      source: 'RECORDED_POLICY_EVENT',
      actuallyEvaluated: false,
      matchedPolicies: [
        {
          policyId: 'demo-policy-1',
          name: 'Allow internal Slack read',
          version: 'v1',
          result: 'ALLOW',
          reason: 'Read-only Slack access is allowed in demo policy.',
          severity: 'LOW',
        },
      ],
    };
  }

  private assertDemoEnabled(): void {
    if (this.configService.get<string>('ENABLE_DEMO_DATA') !== 'true') {
      throw new NotFoundException({ message: 'Demo data is not enabled.' });
    }
  }
}
