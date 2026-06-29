import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { SessionDetailQueryDto, SessionListQueryDto } from '@repo/dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SessionService } from './session.service';

type AuthenticatedRequest = Request & { user?: { sub: string } };

@Controller('api/v1/session')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get('overview')
  getOverview(
    @Query() query: SessionListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.sessionService.listSessions(
      { ...query, kind: 'overview' },
      req.user!.sub,
    );
  }

  @Get('live')
  getLive(
    @Query() query: SessionListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.sessionService.listSessions(
      { ...query, kind: 'live' },
      req.user!.sub,
    );
  }

  @Get('completed')
  getCompleted(
    @Query() query: SessionListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.sessionService.listSessions(
      { ...query, kind: 'completed' },
      req.user!.sub,
    );
  }

  @Get('failed')
  getFailed(
    @Query() query: SessionListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.sessionService.listSessions(
      { ...query, kind: 'failed' },
      req.user!.sub,
    );
  }

  @Get('anomaly')
  getAnomaly(
    @Query() query: SessionListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.sessionService.listSessions(
      { ...query, kind: 'anomaly' },
      req.user!.sub,
    );
  }

  @Get()
  listSessions(
    @Query() query: SessionListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.sessionService.listSessions(query, req.user!.sub);
  }

  @Get(':sessionId')
  getDetail(
    @Param('sessionId') sessionId: string,
    @Query() query: SessionDetailQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.sessionService.getDetail(sessionId, query, req.user!.sub);
  }

  @Get(':sessionId/timeline')
  getTimeline(
    @Param('sessionId') sessionId: string,
    @Query() query: SessionDetailQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.sessionService.getTimeline(sessionId, query, req.user!.sub);
  }
}
