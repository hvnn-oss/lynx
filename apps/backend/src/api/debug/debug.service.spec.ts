import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventEntity, SessionEntity } from '@repo/database';
import { WorkspaceAccessService } from '../../common/services/workspace-access.service';
import { DebugService } from './debug.service';

const workspaceId = '00000000-0000-4000-8000-000000000101';
const userId = 'user-1';

function createQueryBuilder(result: unknown) {
  return {
    addOrderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(result),
    getOne: jest.fn().mockResolvedValue(result),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
  };
}

describe('DebugService', () => {
  let eventQueryBuilder: ReturnType<typeof createQueryBuilder>;
  let sessionQueryBuilder: ReturnType<typeof createQueryBuilder>;
  let workspaceAccess: { assertAccess: jest.Mock };
  let service: DebugService;

  beforeEach(() => {
    eventQueryBuilder = createQueryBuilder([]);
    sessionQueryBuilder = createQueryBuilder({
      id: 'session-1',
      name: 'run-1',
      workspaceId,
      startedAt: new Date('2026-06-28T00:00:00.000Z'),
      endedAt: new Date('2026-06-28T00:01:00.000Z'),
      status: 'FAILED',
      events: [],
      totalTokens: 0,
      totalCost: 0,
    });
    workspaceAccess = {
      assertAccess: jest.fn().mockResolvedValue(undefined),
    };

    const dataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === EventEntity) {
          return { createQueryBuilder: jest.fn(() => eventQueryBuilder) };
        }
        if (entity === SessionEntity) {
          return { createQueryBuilder: jest.fn(() => sessionQueryBuilder) };
        }
        throw new Error('Unexpected repository');
      }),
    };

    service = new DebugService(
      dataSource as unknown as DataSource,
      workspaceAccess as unknown as WorkspaceAccessService,
    );
  });

  it('rejects analysis requests with a range wider than seven days', async () => {
    await expect(
      service.getLatency(
        {
          workspaceId,
          from: '2026-06-01T00:00:00.000Z',
          to: '2026-06-10T00:00:00.000Z',
        },
        userId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(workspaceAccess.assertAccess).toHaveBeenCalledWith(
      userId,
      workspaceId,
    );
    expect(eventQueryBuilder.getMany).not.toHaveBeenCalled();
  });

  it('rejects interactive timeline requests for oversized sessions', async () => {
    eventQueryBuilder.getMany.mockResolvedValue(
      Array.from({ length: 5001 }, (_, index) => ({
        id: `event-${index}`,
        eventType: 'LLM_CALL',
        label: 'LLM call',
        timestamp: new Date('2026-06-28T00:00:00.000Z'),
        payload: {},
      })),
    );

    await expect(
      service.getTimeline('session-1', { workspaceId }, userId),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(eventQueryBuilder.take).toHaveBeenCalledWith(5001);
  });
});
