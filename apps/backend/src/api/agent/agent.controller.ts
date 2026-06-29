import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import {
  AgentDetailQueryDto,
  AgentListQueryDto,
  AgentPageKind,
} from '@repo/dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AgentService } from './agent.service';

type AuthenticatedRequest = Request & { user?: { sub: string } };

@Controller('api/v1/agent')
@UseGuards(JwtAuthGuard)
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Get('overview')
  getOverview(
    @Query() query: AgentListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.agentService.listAgents(
      { ...query, kind: 'overview' },
      req.user!.sub,
    );
  }

  @Get('active')
  getActive(
    @Query() query: AgentListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.agentService.listAgents(
      { ...query, kind: 'active' },
      req.user!.sub,
    );
  }

  @Get('inactive')
  getInactive(
    @Query() query: AgentListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.agentService.listAgents(
      { ...query, kind: 'inactive' },
      req.user!.sub,
    );
  }

  @Get('groups')
  getGroups(
    @Query() query: AgentListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.agentService.listAgents(
      { ...query, kind: 'groups' },
      req.user!.sub,
    );
  }

  @Get('intent')
  getIntent(
    @Query() query: AgentListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.agentService.listAgents(
      { ...query, kind: 'intent' },
      req.user!.sub,
    );
  }

  @Get('tools')
  getTools(
    @Query() query: AgentListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.agentService.listAgents(
      { ...query, kind: 'tools' },
      req.user!.sub,
    );
  }

  @Get('saas')
  getSaas(@Query() query: AgentListQueryDto, @Req() req: AuthenticatedRequest) {
    return this.agentService.listAgents(
      { ...query, kind: 'saas' },
      req.user!.sub,
    );
  }

  @Get('history')
  getHistory(
    @Query() query: AgentListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.agentService.listAgents(
      { ...query, kind: 'history' },
      req.user!.sub,
    );
  }

  @Get('perf/:kind')
  getPerformance(
    @Param('kind')
    kind: Extract<
      AgentPageKind,
      'latency' | 'tokens' | 'success-rate' | 'cost'
    >,
    @Query() query: AgentListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.agentService.listAgents({ ...query, kind }, req.user!.sub);
  }

  @Get()
  listAgents(
    @Query() query: AgentListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.agentService.listAgents(query, req.user!.sub);
  }

  @Get(':agentId')
  getDetail(
    @Param('agentId') agentId: string,
    @Query() query: AgentDetailQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.agentService.getDetail(agentId, query, req.user!.sub);
  }
}
