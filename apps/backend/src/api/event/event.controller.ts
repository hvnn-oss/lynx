import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { EventService } from './event.service';
import { LynxEventDto, LynxEventType } from '@repo/dto';

export class IngestEventDto implements LynxEventDto {
  clientId!: string;
  runId!: string;
  agentName!: string;
  eventType!: LynxEventType;
  label!: string;
  payload!: any;
  timestamp!: number;
  workspaceId?: string;
  agentId?: string;
  sessionId?: string;
}

@Controller('api/v1/events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  // 텔레메트리 이벤트를 수집하여 저장합니다.
  @Post('ingest')
  @HttpCode(HttpStatus.OK)
  async ingest(@Body() dto: IngestEventDto) {
    return await this.eventService.ingestEvent(dto);
  }

  // 텔레메트리 배치 이벤트를 수집하여 저장합니다.
  @Post('batch')
  @HttpCode(HttpStatus.OK)
  async ingestBatch(@Body() dtos: IngestEventDto[]) {
    return await this.eventService.ingestEvents(dtos);
  }
}
