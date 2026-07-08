import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  AgentDetailQueryDto,
  AgentListQueryDto,
  AgentPageKind,
} from '@repo/dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';
import { AgentService } from './agent.service';

@Controller('api/v1/agent')
@UseGuards(JwtAuthGuard)
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Get('overview')
  getOverview(
    @Query() query: AgentListQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.agentService.listAgents({ ...query, kind: 'overview' }, userId);
  }

  @Get('active')
  getActive(
    @Query() query: AgentListQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.agentService.listAgents({ ...query, kind: 'active' }, userId);
  }

  @Get('inactive')
  getInactive(
    @Query() query: AgentListQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.agentService.listAgents({ ...query, kind: 'inactive' }, userId);
  }

  @Get('groups')
  getGroups(
    @Query() query: AgentListQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.agentService.listAgents({ ...query, kind: 'groups' }, userId);
  }

  @Get('intent')
  getIntent(
    @Query() query: AgentListQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.agentService.listAgents({ ...query, kind: 'intent' }, userId);
  }

  @Get('tools')
  getTools(@Query() query: AgentListQueryDto, @CurrentUserId() userId: string) {
    return this.agentService.listAgents({ ...query, kind: 'tools' }, userId);
  }

  @Get('saas')
  getSaas(@Query() query: AgentListQueryDto, @CurrentUserId() userId: string) {
    return this.agentService.listAgents({ ...query, kind: 'saas' }, userId);
  }

  @Get('history')
  getHistory(
    @Query() query: AgentListQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.agentService.listAgents({ ...query, kind: 'history' }, userId);
  }

  @Get('perf/:kind')
  getPerformance(
    @Param('kind')
    kind: Extract<
      AgentPageKind,
      'latency' | 'tokens' | 'success-rate' | 'cost'
    >,
    @Query() query: AgentListQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.agentService.listAgents({ ...query, kind }, userId);
  }

  @Get()
  listAgents(
    @Query() query: AgentListQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.agentService.listAgents(query, userId);
  }

  @Get(':agentId')
  getDetail(
    @Param('agentId') agentId: string,
    @Query() query: AgentDetailQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.agentService.getDetail(agentId, query, userId);
  }
}
