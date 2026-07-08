import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { WorkspaceAccessService } from './workspace-access.service';

describe('WorkspaceAccessService', () => {
  const queryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  const dataSource = {
    getRepository: jest.fn(() => ({
      createQueryBuilder: jest.fn(() => queryBuilder),
    })),
  } as unknown as DataSource;

  let service: WorkspaceAccessService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkspaceAccessService(dataSource);
  });

  it('should reject missing workspace id before querying', async () => {
    await expect(service.assertAccess('user-1', '')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(dataSource.getRepository).not.toHaveBeenCalled();
  });

  it('should reject when membership is not found', async () => {
    queryBuilder.getOne.mockResolvedValue(null);

    await expect(
      service.assertAccess('user-1', 'workspace-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should allow access when membership exists', async () => {
    queryBuilder.getOne.mockResolvedValue({ id: 'membership-1' });

    await expect(
      service.assertAccess('user-1', 'workspace-1'),
    ).resolves.toBeUndefined();
  });
});
