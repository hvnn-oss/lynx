import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  DebugAnalysisQueryDto,
  DebugEventLogQueryDto,
  DebugPolicySimulationRequestDto,
  DebugReproduceRequestDto,
  DebugSessionListQueryDto,
  DebugTimelineQueryDto,
} from '@repo/dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DebugService } from './debug.service';

type AuthenticatedRequest = Request & { user?: { sub: string } };

@Controller('api/v1/debug')
@UseGuards(JwtAuthGuard)
export class DebugController {
  constructor(private readonly debugService: DebugService) {}

  @Get('sessions')
  listSessions(
    @Query() query: DebugSessionListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.debugService.listSessions(query, req.user!.sub);
  }

  @Get('logs')
  listLogs(
    @Query() query: DebugEventLogQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.debugService.listEvents(query, req.user!.sub);
  }

  @Get('tool-calls')
  listToolCalls(
    @Query() query: DebugEventLogQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.debugService.listToolCalls(query, req.user!.sub);
  }

  @Get('llm-io')
  listLlmCalls(
    @Query() query: DebugEventLogQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.debugService.listLlmCalls(query, req.user!.sub);
  }

  @Get('errors')
  listErrors(
    @Query() query: DebugEventLogQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.debugService.listErrors(query, req.user!.sub);
  }

  @Get('sessions/:sessionId/events')
  listSessionEvents(
    @Param('sessionId') sessionId: string,
    @Query() query: DebugEventLogQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.debugService.listSessionEvents(sessionId, query, req.user!.sub);
  }

  @Get('sessions/:sessionId/timeline')
  getTimeline(
    @Param('sessionId') sessionId: string,
    @Query() query: DebugTimelineQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.debugService.getTimeline(sessionId, query, req.user!.sub);
  }

  @Get('sessions/:sessionId/root-cause')
  getRootCause(
    @Param('sessionId') sessionId: string,
    @Query() query: DebugTimelineQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.debugService.getRootCause(sessionId, query, req.user!.sub);
  }

  @Get('sessions/:sessionId/memory')
  getMemory(
    @Param('sessionId') sessionId: string,
    @Query() query: DebugTimelineQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.debugService.getMemory(sessionId, query, req.user!.sub);
  }

  @Post('sessions/:sessionId/reproduce')
  reproduce(
    @Param('sessionId') sessionId: string,
    @Body() body: DebugReproduceRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.debugService.reproduce(sessionId, body, req.user!.sub);
  }

  @Post('sessions/:sessionId/policy/simulate')
  simulatePolicy(
    @Param('sessionId') sessionId: string,
    @Body() body: DebugPolicySimulationRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.debugService.simulatePolicy(sessionId, body, req.user!.sub);
  }

  @Get('patterns')
  getPatterns(
    @Query() query: DebugAnalysisQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.debugService.getPatterns(query, req.user!.sub);
  }

  @Get('bottlenecks')
  getBottlenecks(
    @Query() query: DebugAnalysisQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.debugService.getBottlenecks(query, req.user!.sub);
  }

  @Get('latency')
  getLatency(
    @Query() query: DebugAnalysisQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.debugService.getLatency(query, req.user!.sub);
  }
}
