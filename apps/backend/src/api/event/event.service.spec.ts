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

  const mockDeleteQueryBuilder = {
    delete: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest
      .fn()
      .mockImplementation((fn: (subQueryBuilder: any) => void) => {
        if (typeof fn === 'function') {
          fn(mockDeleteQueryBuilder);
        }
        return mockDeleteQueryBuilder;
      }),
    setParameter: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 10 }),
    subQuery: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    getQuery: jest.fn().mockReturnValue('(SELECT id FROM session)'),
  };

  const mockEventRepository = {
    create: jest.fn((data: unknown) => data),
    save: jest.fn((data: unknown) => Promise.resolve(data)),
    createQueryBuilder: jest.fn(() => mockDeleteQueryBuilder),
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
    createQueryBuilder: jest.fn(() => mockDeleteQueryBuilder),
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

    const result = await service.ingestEvent(dto, 'test-api-key');
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

    const result = await service.ingestEvent(dto, 'test-api-key');
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

    const result = await service.ingestEvents(dtos, 'test-api-key');
    expect(result.success).toBe(false);
    expect(result.count).toBe(2);

    const details = result.details as Array<{
      success: boolean;
      result: { success: boolean; reason?: string };
    }>;
    expect(details[0].success).toBe(true);
    expect(details[1].success).toBe(false);
    expect(details[1].result.success).toBe(false); // second one failed retention check
  });

  describe('cleanExpiredEvents', () => {
    it('should successfully run cleanExpiredEvents and execute delete queries for each tier', async () => {
      mockDeleteQueryBuilder.execute.mockClear();
      mockConfigService.get.mockImplementation(((key: string) => {
        if (key === 'RETENTION_DAYS_FREE') return 5;
        if (key === 'RETENTION_DAYS_PRO') return 15;
        if (key === 'RETENTION_DAYS_ENTERPRISE') return 100;
        return undefined;
      }) as any);

      await service.cleanExpiredEvents();

      // Should execute delete query for each of the 3 plans (FREE, PRO, ENTERPRISE)
      expect(mockEventRepository.createQueryBuilder).toHaveBeenCalledTimes(3);
      expect(mockDeleteQueryBuilder.execute).toHaveBeenCalledTimes(3);
    });
  });

  describe('ingestEvent additional scenarios', () => {
    it('should reject ingestion if no workspace is found for the API key', async () => {
      mockWorkspaceRepository.findOne.mockResolvedValueOnce(null as any);

      const dto: LynxEventDto = {
        clientId: 'client-1',
        runId: 'trace-1',
        agentName: 'TestAgent',
        eventType: 'LLM_REASONING' as LynxEventType,
        label: 'gpt-4o',
        payload: {},
        timestamp: Date.now(),
        workspaceId: 'non-existent-ws',
      };

      await expect(service.ingestEvent(dto, 'bad-api-key')).rejects.toThrow(
        'Invalid API key.',
      );
    });

    it('should reject ingestion without an API key', async () => {
      const dto: LynxEventDto = {
        clientId: 'client-1',
        runId: 'trace-1',
        agentName: 'TestAgent',
        eventType: 'LLM_REASONING' as LynxEventType,
        label: 'gpt-4o',
        payload: {},
        timestamp: Date.now(),
        workspaceId: 'ws-1',
      };

      await expect(service.ingestEvent(dto)).rejects.toThrow(
        'API key is required.',
      );
    });

    it('should lookup workspace using API key if provided', async () => {
      mockWorkspaceRepository.findOne.mockClear();
      const dto: LynxEventDto = {
        clientId: 'client-1',
        runId: 'trace-1',
        agentName: 'TestAgent',
        eventType: 'LLM_REASONING' as LynxEventType,
        label: 'gpt-4o',
        payload: {},
        timestamp: Date.now(),
      };

      await service.ingestEvent(dto, 'test-api-key');
      expect(mockWorkspaceRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { apiKey: 'test-api-key' } }),
      );
    });

    it('should estimate LLM cost correctly for different models', async () => {
      const modelsToTest = [
        {
          name: 'gpt-4-turbo',
          prompt: 1000,
          completion: 1000,
          expectedCost: (1000 * 30.0 + 1000 * 60.0) / 1000000,
        },
        {
          name: 'gpt-3.5-turbo',
          prompt: 1000,
          completion: 1000,
          expectedCost: (1000 * 0.5 + 1000 * 1.5) / 1000000,
        },
        {
          name: 'claude-3-5-sonnet',
          prompt: 1000,
          completion: 1000,
          expectedCost: (1000 * 3.0 + 1000 * 15.0) / 1000000,
        },
        {
          name: 'claude-3-opus',
          prompt: 1000,
          completion: 1000,
          expectedCost: (1000 * 15.0 + 1000 * 75.0) / 1000000,
        },
        {
          name: 'gemini-1.5-pro',
          prompt: 1000,
          completion: 1000,
          expectedCost: (1000 * 0.075 + 1000 * 0.3) / 1000000,
        },
        {
          name: 'unknown-model',
          prompt: 1000,
          completion: 1000,
          expectedCost: (1000 * 1.0 + 1000 * 2.0) / 1000000,
        },
      ];

      for (const t of modelsToTest) {
        mockEventRepository.save.mockClear();
        const dto: LynxEventDto = {
          clientId: 'client-1',
          runId: 'trace-1',
          agentName: 'TestAgent',
          eventType: 'LLM_REASONING' as LynxEventType,
          label: 'some-label',
          payload: {
            model: t.name,
            usage: {
              promptTokens: t.prompt,
              completionTokens: t.completion,
              totalTokens: t.prompt + t.completion,
            },
          },
          timestamp: Date.now(),
          workspaceId: 'ws-1',
        };

        const result = await service.ingestEvent(dto, 'test-api-key');
        expect(result.success).toBe(true);
        expect(mockEventRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            cost: t.expectedCost,
          }),
        );
      }
    });

    it('should use provided cost in payload if it is explicitly set', async () => {
      mockEventRepository.save.mockClear();
      const dto: LynxEventDto = {
        clientId: 'client-1',
        runId: 'trace-1',
        agentName: 'TestAgent',
        eventType: 'LLM_REASONING' as LynxEventType,
        label: 'gpt-4o',
        payload: {
          cost: 9.99,
          usage: {
            promptTokens: 1000,
            completionTokens: 1000,
            totalTokens: 2000,
          },
        },
        timestamp: Date.now(),
        workspaceId: 'ws-1',
      };

      const result = await service.ingestEvent(dto, 'test-api-key');
      expect(result.success).toBe(true);
      expect(mockEventRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          cost: 9.99,
        }),
      );
    });

    it('should create new agent and session if they are not found', async () => {
      mockAgentRepository.findOne
        .mockResolvedValueOnce(null as any)
        .mockResolvedValueOnce(null as any);
      mockSessionRepository.findOne
        .mockResolvedValueOnce(null as any)
        .mockResolvedValueOnce(null as any);

      mockAgentRepository.create.mockClear();
      mockSessionRepository.create.mockClear();

      const dto: LynxEventDto = {
        clientId: 'client-1',
        runId: 'trace-1',
        agentName: 'Brand New Agent',
        eventType: 'LLM_REASONING' as LynxEventType,
        label: 'gpt-4o',
        payload: {},
        timestamp: Date.now(),
        workspaceId: 'ws-1',
        agentId: 'new-agent-uuid-11111111111111111111',
        sessionId: 'new-session-uuid-22222222222222222222',
      };

      const result = await service.ingestEvent(dto, 'test-api-key');
      expect(result.success).toBe(true);
      expect(mockAgentRepository.create).toHaveBeenCalled();
      expect(mockSessionRepository.create).toHaveBeenCalled();
    });
  });
});
