/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ObserveController } from './observe.controller';
import { ObserveService } from './observe.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('ObserveController', () => {
  let controller: ObserveController;
  let service: ObserveService;

  const mockObserveService = {
    getOverviewMetrics: jest.fn(() =>
      Promise.resolve({ totalSessions: 1, totalCost: 0.1 }),
    ),
    getAnalytics: jest.fn(() => Promise.resolve({ analytics: [] })),
    getAgentStats: jest.fn(() => Promise.resolve([])),
    getSessions: jest.fn(() => Promise.resolve([])),
    getSessionTimeline: jest.fn(() => Promise.resolve([])),
    getRecentErrors: jest.fn(() => Promise.resolve([])),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ObserveController],
      providers: [
        {
          provide: ObserveService,
          useValue: mockObserveService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ObserveController>(ObserveController);
    service = module.get<ObserveService>(ObserveService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get overview metrics', async () => {
    const result = await controller.getOverviewMetrics('ws-1');
    expect(service.getOverviewMetrics).toHaveBeenCalledWith('ws-1');
    expect(result).toEqual({ totalSessions: 1, totalCost: 0.1 });
  });

  it('should get analytics', async () => {
    const result = await controller.getAnalytics('ws-1', '5');
    expect(service.getAnalytics).toHaveBeenCalledWith('ws-1', 5);
    expect(result).toEqual({ analytics: [] });
  });

  it('should get sessions list', async () => {
    await controller.getSessions('ws-1', 'RUNNING');
    expect(service.getSessions).toHaveBeenCalledWith('ws-1', 'RUNNING');
  });

  it('should get timeline details', async () => {
    await controller.getSessionTimeline('sess-1');
    expect(service.getSessionTimeline).toHaveBeenCalledWith('sess-1');
  });

  it('should get recent errors', async () => {
    await controller.getRecentErrors('ws-1', '10');
    expect(service.getRecentErrors).toHaveBeenCalledWith('ws-1', 10);
  });
});
