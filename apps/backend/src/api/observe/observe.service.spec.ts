/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { ObserveService } from './observe.service';
import { DataSource } from 'typeorm';
import { OrganizationUserEntity } from '@repo/database';
import { WorkspaceAccessService } from '../../common/services/workspace-access.service';

describe('ObserveService', () => {
  let service: ObserveService;

  const mockSessions = [
    { id: 'sess-1', totalCost: 0.1, totalTokens: 100 },
    { id: 'sess-2', totalCost: 0.2, totalTokens: 200 },
  ];

  const mockSessionRepository = {
    find: jest.fn(() => Promise.resolve(mockSessions)),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn(() => Promise.resolve(mockSessions)),
    })),
  };

  const mockEventRepository = {
    find: jest.fn(() => Promise.resolve([])),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(() => Promise.resolve({ avg: '150.5' })),
      getCount: jest.fn(() => Promise.resolve(10)),
      getRawMany: jest.fn(() =>
        Promise.resolve([{ date: '2026-06-20', cost: '0.3', calls: '10' }]),
      ),
      getMany: jest.fn(() => Promise.resolve([])),
    })),
  };

  const mockAgentRepository = {
    find: jest.fn(() => Promise.resolve([])),
  };

  const mockMembershipQueryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(() => Promise.resolve({ id: 'membership-1' })),
  };

  const mockOrganizationUserRepository = {
    createQueryBuilder: jest.fn(() => mockMembershipQueryBuilder),
  };

  const mockDataSource = {
    getRepository: jest.fn((entity: { name: string }) => {
      if (entity === OrganizationUserEntity)
        return mockOrganizationUserRepository;
      const name = entity.name;
      if (name === 'SessionEntity') return mockSessionRepository;
      if (name === 'EventEntity') return mockEventRepository;
      if (name === 'AgentEntity') return mockAgentRepository;
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ObserveService,
        WorkspaceAccessService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ObserveService>(ObserveService);

    mockEventRepository.createQueryBuilder.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(() => Promise.resolve({ avg: '150.5' })),
      getCount: jest.fn(() => Promise.resolve(10)),
      getRawMany: jest.fn(() =>
        Promise.resolve([{ date: '2026-06-20', cost: '0.3', calls: '10' }]),
      ),
      getMany: jest.fn(() => Promise.resolve([])),
    }));

    jest.clearAllMocks();
    mockMembershipQueryBuilder.getOne.mockResolvedValue({ id: 'membership-1' });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate overview metrics', async () => {
    const result = await service.getOverviewMetrics('ws-1', 'user-1');
    expect(result.totalSessions).toBe(2);
    expect(result.totalCost).toBeCloseTo(0.3);
    expect(result.totalTokens).toBe(300);
    expect(result.avgLatency).toBe(150.5);
  });

  it('should retrieve time-series analytics', async () => {
    const result = await service.getAnalytics('ws-1', 'user-1', 7);
    expect(result.analytics.length).toBe(1);
    expect(result.analytics[0].cost).toBe(0.3);
    expect(result.analytics[0].calls).toBe(10);
  });

  it('should retrieve sessions list', async () => {
    const result = await service.getSessions('ws-1', 'user-1', 'RUNNING');
    expect(result.length).toBe(2);
  });

  it('should calculate overview metrics with empty database', async () => {
    mockSessionRepository.find.mockResolvedValueOnce([]);
    (mockEventRepository.createQueryBuilder as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValueOnce({ avg: null }),
      getCount: jest.fn().mockResolvedValue(0),
    } as any);

    const result = await service.getOverviewMetrics('ws-1', 'user-1');
    expect(result.totalSessions).toBe(0);
    expect(result.totalCost).toBe(0);
    expect(result.totalTokens).toBe(0);
    expect(result.avgLatency).toBe(0);
    expect(result.errorRate).toBe(0);
  });

  it('should retrieve agent stats with sessions and calculate totals', async () => {
    const mockAgents = [
      {
        id: 'agent-1',
        name: 'Agent One',
        sessions: [
          { totalTokens: 100, totalCost: 0.1 },
          { totalTokens: 200, totalCost: 0.2 },
        ],
      },
      {
        id: 'agent-2',
        name: 'Agent Two',
        sessions: [],
      },
    ];
    mockAgentRepository.find.mockResolvedValueOnce(mockAgents as any);

    interface AgentStatResult {
      id: string;
      name: string;
      runCount: number;
      totalTokens: number;
      totalCost: number;
      avgLatency: number;
    }

    const result = (await service.getAgentStats(
      'ws-1',
      'user-1',
    )) as unknown as AgentStatResult[];
    expect(result.length).toBe(2);
    expect(result[0].id).toBe('agent-1');
    expect(result[0].runCount).toBe(2);
    expect(result[0].totalTokens).toBe(300);
    expect(result[0].totalCost).toBeCloseTo(0.3);
    expect(result[0].avgLatency).toBe(150.5);

    expect(result[1].id).toBe('agent-2');
    expect(result[1].runCount).toBe(0);
    expect(result[1].totalTokens).toBe(0);
    expect(result[1].totalCost).toBe(0);
    expect(result[1].avgLatency).toBe(150.5);
  });

  it('should retrieve timeline details with event mapping', async () => {
    const mockEvents = [
      {
        id: 'evt-1',
        eventType: 'LLM_REASONING',
        label: 'gpt-4o',
        timestamp: new Date('2026-06-21T00:00:00Z'),
        latency: 1200,
        cost: 0.05,
        payload: {
          spanId: 'span-1',
          parentSpanId: undefined,
          input: 'hello',
          output: 'world',
          error: undefined,
        },
      },
      {
        id: 'evt-2',
        eventType: 'ERROR',
        label: 'error-label',
        timestamp: new Date('2026-06-21T00:01:00Z'),
        latency: 100,
        cost: 0.0,
        payload: {
          spanId: 'span-2',
          parentSpanId: 'span-1',
          input: 'hello',
          error: 'Something went wrong',
        },
      },
    ];
    mockEventRepository.find.mockResolvedValueOnce(mockEvents as any);

    const result = await service.getSessionTimeline('ws-1', 'user-1', 'sess-1');
    expect(result.length).toBe(2);
    expect(result[0].id).toBe('evt-1');
    expect(result[0].eventType).toBe('LLM_REASONING');
    expect(result[0].cost).toBe(0.05);
    expect(result[0].spanId).toBe('span-1');
    expect(result[0].input).toBe('hello');
    expect(result[0].output).toBe('world');
    expect(result[0].error).toBeUndefined();

    expect(result[1].id).toBe('evt-2');
    expect(result[1].eventType).toBe('ERROR');
    expect(result[1].cost).toBe(0.0);
    expect(result[1].spanId).toBe('span-2');
    expect(result[1].parentSpanId).toBe('span-1');
    expect(result[1].error).toBe('Something went wrong');
  });

  it('should retrieve recent errors log', async () => {
    const result = await service.getRecentErrors('ws-1', 'user-1', 5);
    expect(result).toEqual([]);
  });
});
