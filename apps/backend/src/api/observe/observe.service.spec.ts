import { Test, TestingModule } from '@nestjs/testing';
import { ObserveService } from './observe.service';
import { DataSource } from 'typeorm';

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

  const mockDataSource = {
    getRepository: jest.fn((entity: { name: string }) => {
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
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ObserveService>(ObserveService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate overview metrics', async () => {
    const result = await service.getOverviewMetrics('ws-1');
    expect(result.totalSessions).toBe(2);
    expect(result.totalCost).toBeCloseTo(0.3);
    expect(result.totalTokens).toBe(300);
    expect(result.avgLatency).toBe(150.5);
  });

  it('should retrieve time-series analytics', async () => {
    const result = await service.getAnalytics('ws-1', 7);
    expect(result.analytics.length).toBe(1);
    expect(result.analytics[0].cost).toBe(0.3);
    expect(result.analytics[0].calls).toBe(10);
  });

  it('should retrieve sessions list', async () => {
    const result = await service.getSessions('ws-1', 'RUNNING');
    expect(result.length).toBe(2);
  });

  it('should retrieve timeline details', async () => {
    const result = await service.getSessionTimeline('sess-1');
    expect(result).toEqual([]);
  });

  it('should retrieve recent errors log', async () => {
    const result = await service.getRecentErrors('ws-1', 5);
    expect(result).toEqual([]);
  });
});
