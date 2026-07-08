import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { SessionDetailQueryDto, SessionListQueryDto } from '@repo/dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';
import { SessionService } from './session.service';

@Controller('api/v1/session')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get('overview')
  getOverview(
    @Query() query: SessionListQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.sessionService.listSessions(
      { ...query, kind: 'overview' },
      userId,
    );
  }

  @Get('live')
  getLive(
    @Query() query: SessionListQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.sessionService.listSessions({ ...query, kind: 'live' }, userId);
  }

  @Get('completed')
  getCompleted(
    @Query() query: SessionListQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.sessionService.listSessions(
      { ...query, kind: 'completed' },
      userId,
    );
  }

  @Get('failed')
  getFailed(
    @Query() query: SessionListQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.sessionService.listSessions(
      { ...query, kind: 'failed' },
      userId,
    );
  }

  @Get('anomaly')
  getAnomaly(
    @Query() query: SessionListQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.sessionService.listSessions(
      { ...query, kind: 'anomaly' },
      userId,
    );
  }

  @Get()
  listSessions(
    @Query() query: SessionListQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.sessionService.listSessions(query, userId);
  }

  @Get(':sessionId')
  getDetail(
    @Param('sessionId') sessionId: string,
    @Query() query: SessionDetailQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.sessionService.getDetail(sessionId, query, userId);
  }

  @Get(':sessionId/timeline')
  getTimeline(
    @Param('sessionId') sessionId: string,
    @Query() query: SessionDetailQueryDto,
    @CurrentUserId() userId: string,
  ) {
    return this.sessionService.getTimeline(sessionId, query, userId);
  }
}
