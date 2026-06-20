import { Test, TestingModule } from '@nestjs/testing';
import { EventService } from './event.service';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { LynxEventDto, LynxEventType } from '@repo/dto';

describe('EventService', () => {
  let service: EventService;

  const mockWorkspace = {
    id: 'ws-1',
    name: 'Test Workspace',
    plan: 'FREE',
  };

  const mockAgent = {
    id: 'agent-1',
    name: 'Test Agent',
  };

  const mockSession = {
    id: 'sess-1',
    name: 'Test Session',
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    totalCost: 0,
  };

  const mockWorkspaceRepository = {
    findOne: jest.fn(() => Promise.resolve(mockWorkspace)),
  };

  const mockAgentRepository = {
    findOne: jest.fn(() => Promise.resolve(mockAgent)),
    create: jest.fn(() => mockAgent),
    save: jest.fn(() => Promise.resolve(mockAgent)),
  };

  const mockSessionRepository = {
    findOne: jest.fn(() => Promise.resolve(mockSession)),
    create: jest.fn(() => mockSession),
    save: jest.fn(() => Promise.resolve(mockSession)),
  };

  const mockEventRepository = {
    create: jest.fn((data: unknown) => data),
    save: jest.fn((data: unknown) => Promise.resolve(data)),
  };

  const mockDataSource = {
    getRepository: jest.fn((entity: { name: string }) => {
      const name = entity.name;
      if (name === 'WorkspaceEntity') return mockWorkspaceRepository;
      if (name === 'AgentEntity') return mockAgentRepository;
      if (name === 'SessionEntity') return mockSessionRepository;
      if (name === 'EventEntity') return mockEventRepository;
      return null;
    }),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'RETENTION_DAYS_FREE') return 3;
      if (key === 'RETENTION_DAYS_PRO') return 30;
      return undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EventService>(EventService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should ingest an event and estimate cost server-side', async () => {
    const dto: LynxEventDto = {
      clientId: 'client-1',
      runId: 'trace-1',
      agentName: 'TestAgent',
      eventType: 'LLM_REASONING' as LynxEventType,
      label: 'gpt-4o', // will trigger cost calculation for gpt-4o
      payload: {
        usage: {
          promptTokens: 100000, // 0.1M tokens
          completionTokens: 200000, // 0.2M tokens
          totalTokens: 300000,
        },
      },
      timestamp: Date.now(),
      workspaceId: 'ws-1',
      agentId: 'agent-1',
      sessionId: 'sess-1',
    };

    const result = await service.ingestEvent(dto);
    expect(result.success).toBe(true);

    // gpt-4o rates: input = 2.50/M, output = 10.00/M
    // (100,000 * 2.50 + 200,000 * 10.00) / 1,000,000 = (250,000 + 2,000,000) / 1,000,000 = 2.25 USD
    expect(mockEventRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'LLM_REASONING',
        label: 'gpt-4o',
        cost: 2.25,
      }),
    );
  });

  it('should skip ingestion if older than retention limit', async () => {
    const oldTimestamp = Date.now() - 5 * 24 * 60 * 60 * 1000; // 5 days old (limit is 3 days)
    const dto: LynxEventDto = {
      clientId: 'client-1',
      runId: 'trace-1',
      agentName: 'TestAgent',
      eventType: 'LLM_REASONING' as LynxEventType,
      label: 'gpt-4o',
      payload: {},
      timestamp: oldTimestamp,
      workspaceId: 'ws-1',
    };

    const result = await service.ingestEvent(dto);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('retention limit');
  });

  it('should process batches sequentially and handle individual failures gracefully', async () => {
    const dtos: LynxEventDto[] = [
      {
        clientId: 'client-1',
        runId: 'trace-1',
        agentName: 'TestAgent',
        eventType: 'LLM_REASONING' as LynxEventType,
        label: 'gpt-4o',
        payload: {},
        timestamp: Date.now(),
        workspaceId: 'ws-1',
      },
      {
        clientId: 'client-1',
        runId: 'trace-2',
        agentName: 'TestAgent',
        eventType: 'LLM_REASONING' as LynxEventType,
        label: 'gpt-4o',
        payload: {},
        timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000, // should fail retention
        workspaceId: 'ws-1',
      },
    ];

    const result = await service.ingestEvents(dtos);
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);

    const details = result.details as Array<{
      success: boolean;
      result: { success: boolean; reason?: string };
    }>;
    expect(details[0].success).toBe(true);
    expect(details[1].success).toBe(true); // returns success/failure within details
    expect(details[1].result.success).toBe(false); // second one failed retention check
  });
});
