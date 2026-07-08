import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  DebugAnalysisQueryDto,
  DebugEventLogQueryDto,
  DebugPolicySimulationRequestDto,
  DebugReproduceRequestDto,
  DebugSessionListQueryDto,
  DebugTimelineQueryDto,
} from '@repo/dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';
import { DebugService } from './debug.service';

@Controller('api/v1/debug')
@UseGuards(JwtAuthGuard)
export class DebugController {
  constructor(private readonly debugService: DebugService) {}

  @Get('sessions')
  listSessions(
    @Query() query: DebugSessionListQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.debugService.listSessions(query, userId);
  }

  @Get('logs')
  listLogs(
    @Query() query: DebugEventLogQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.debugService.listEvents(query, userId);
  }

  @Get('tool-calls')
  listToolCalls(
    @Query() query: DebugEventLogQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.debugService.listToolCalls(query, userId);
  }

  @Get('llm-io')
  listLlmCalls(
    @Query() query: DebugEventLogQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.debugService.listLlmCalls(query, userId);
  }

  @Get('errors')
  listErrors(
    @Query() query: DebugEventLogQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.debugService.listErrors(query, userId);
  }

  @Get('sessions/:sessionId/events')
  listSessionEvents(
    @Param('sessionId') sessionId: string,
    @Query() query: DebugEventLogQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.debugService.listSessionEvents(sessionId, query, userId);
  }

  @Get('sessions/:sessionId/timeline')
  getTimeline(
    @Param('sessionId') sessionId: string,
    @Query() query: DebugTimelineQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.debugService.getTimeline(sessionId, query, userId);
  }

  @Get('sessions/:sessionId/root-cause')
  getRootCause(
    @Param('sessionId') sessionId: string,
    @Query() query: DebugTimelineQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.debugService.getRootCause(sessionId, query, userId);
  }

  @Get('sessions/:sessionId/memory')
  getMemory(
    @Param('sessionId') sessionId: string,
    @Query() query: DebugTimelineQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.debugService.getMemory(sessionId, query, userId);
  }

  @Post('sessions/:sessionId/reproduce')
  reproduce(
    @Param('sessionId') sessionId: string,
    @Body() body: DebugReproduceRequestDto,
    @CurrentUserId() userId: string,
  ) {
    return this.debugService.reproduce(sessionId, body, userId);
  }

  @Post('sessions/:sessionId/policy/simulate')
  simulatePolicy(
    @Param('sessionId') sessionId: string,
    @Body() body: DebugPolicySimulationRequestDto,
    @CurrentUserId() userId: string,
  ) {
    return this.debugService.simulatePolicy(sessionId, body, userId);
  }

  @Get('patterns')
  getPatterns(
    @Query() query: DebugAnalysisQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.debugService.getPatterns(query, userId);
  }

  @Get('bottlenecks')
  getBottlenecks(
    @Query() query: DebugAnalysisQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.debugService.getBottlenecks(query, userId);
  }

  @Get('latency')
  getLatency(
    @Query() query: DebugAnalysisQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.debugService.getLatency(query, userId);
  }
}
