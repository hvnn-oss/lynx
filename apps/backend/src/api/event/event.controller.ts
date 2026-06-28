import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  ParseArrayPipe,
  Post,
} from '@nestjs/common';
import { IngestEventDto } from '@repo/dto';
import { EventService } from './event.service';

@Controller('openapi/v1/events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

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
