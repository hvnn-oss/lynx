/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { IngestEventDto, LynxEventType } from '@repo/dto';

describe('EventController', () => {
  let controller: EventController;
  let service: EventService;

  const mockEventService = {
    ingestEvent: jest.fn(() => Promise.resolve({ success: true })),
    ingestEvents: jest.fn(() =>
      Promise.resolve({ success: true, count: 1, details: [] }),
    ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventController],
      providers: [
        {
          provide: EventService,
          useValue: mockEventService,
        },
      ],
    }).compile();

    controller = module.get<EventController>(EventController);
    service = module.get<EventService>(EventService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call ingestEvent for single ingestion', async () => {
    const dto: IngestEventDto = {
      clientId: 'test-client',
      runId: 'trace-1',
      agentName: 'TestAgent',
      eventType: 'LLM_REASONING' as LynxEventType,
      label: 'gpt-4o',
      payload: { usage: { promptTokens: 10, completionTokens: 20 } },
      timestamp: Date.now(),
    };

    const result = await controller.ingest(dto, 'test-api-key');
    expect(service.ingestEvent).toHaveBeenCalledWith(dto, 'test-api-key');
    expect(result).toEqual({ success: true });
  });

  it('should call ingestEvents for batch ingestion', async () => {
    const dtos: IngestEventDto[] = [
      {
        clientId: 'test-client',
        runId: 'trace-1',
        agentName: 'TestAgent',
        eventType: 'LLM_REASONING' as LynxEventType,
        label: 'gpt-4o',
        payload: { usage: { promptTokens: 10, completionTokens: 20 } },
        timestamp: Date.now(),
      },
    ];

    const result = await controller.ingestBatch(dtos, 'test-api-key');
    expect(service.ingestEvents).toHaveBeenCalledWith(dtos, 'test-api-key');
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
  });
});
