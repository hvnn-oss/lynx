import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Headers,
  ParseArrayPipe,
} from '@nestjs/common';
import { EventService } from './event.service';
import { LynxEventDto } from '@repo/dto';
import type { LynxEventType } from '@repo/dto';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsObject,
  IsIn,
} from 'class-validator';

// 텔레메트리 이벤트 타입 상수 배열 정의
const EVENT_TYPES: LynxEventType[] = [
  'LLM_REASONING',
  'CALL_TOOLS',
  'ERROR',
  'CONTEXT_ALERT',
];

/**
 * 텔레메트리 이벤트 수집을 위한 DTO 클래스입니다.
 * 모든 API 통신 필드 명세는 영어로 작성되며, class-validator 데코레이터를 적용합니다.
 */
export class IngestEventDto implements LynxEventDto {
  @IsNotEmpty()
  @IsString()
  clientId!: string;

  @IsNotEmpty()
  @IsString()
  runId!: string;

  @IsNotEmpty()
  @IsString()
  agentName!: string;

  @IsNotEmpty()
  @IsIn(EVENT_TYPES)
  eventType!: LynxEventType;

  @IsNotEmpty()
  @IsString()
  label!: string;

  @IsNotEmpty()
  @IsObject()
  payload!: any;

  @IsNotEmpty()
  @IsNumber()
  timestamp!: number;

  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  schemaVersion?: string;
}

@Controller('openapi/v1/events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  // 텔레메트리 이벤트를 수집하여 저장합니다.
  @Post('ingest')
  @HttpCode(HttpStatus.OK)
  async ingest(
    @Body() dto: IngestEventDto,
    @Headers('x-api-key') apiKeyHeader?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const apiKey = apiKeyHeader || this.extractApiKey(authHeader);
    return await this.eventService.ingestEvent(dto, apiKey);
  }

  // 텔레메트리 배치 이벤트를 수집하여 저장합니다.
  @Post('batch')
  @HttpCode(HttpStatus.OK)
  async ingestBatch(
    @Body(new ParseArrayPipe({ items: IngestEventDto }))
    dtos: IngestEventDto[],
    @Headers('x-api-key') apiKeyHeader?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const apiKey = apiKeyHeader || this.extractApiKey(authHeader);
    return await this.eventService.ingestEvents(dtos, apiKey);
  }

  private extractApiKey(authHeader?: string): string | undefined {
    if (!authHeader) return undefined;
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0]?.toLowerCase() === 'bearer') {
      return parts[1];
    }
    return undefined;
  }
}
