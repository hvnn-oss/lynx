import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  OrganizationEntity,
  OrganizationUserEntity,
  WorkspaceApiKeyEntity,
  WorkspaceEntity,
  WorkspacePlanEntity,
} from '@repo/database';
import { USER_PERMISSIONS, WORKSPACE_PLANS } from '@repo/constants';
import { DataSource } from 'typeorm';
import { WorkspaceService } from './workspace.service';

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let organizationUserRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
  };
  let organizationRepository: {
    findOne: jest.Mock;
  };
  let workspaceRepository: {
    create: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  let workspacePlanRepository: {
    findOne: jest.Mock;
  };
  let workspaceApiKeyRepository: {
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  const organization = {
    id: 'org-1',
    name: 'Acme',
  } as OrganizationEntity;
  const workspace = {
    id: 'workspace-1',
    name: 'Production',
    plan: WORKSPACE_PLANS.PRO,
    apiKey: 'lynx_old',
    organization,
  } as WorkspaceEntity;

  beforeEach(async () => {
    organizationUserRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
    };
    organizationRepository = {
      findOne: jest.fn(),
    };
    workspaceRepository = {
      create: jest.fn((input) => ({ id: 'workspace-new', ...input })),
      findOne: jest.fn(),
      save: jest.fn((input) => Promise.resolve(input)),
      remove: jest.fn((input) => Promise.resolve(input)),
    };
    workspacePlanRepository = {
      findOne: jest.fn(() =>
        Promise.resolve({
          code: WORKSPACE_PLANS.FREE,
          name: 'Free',
          retentionDays: 3,
          monthlyEventLimit: 10000,
          includedLogCount: 10000,
          features: [],
          isActive: true,
        }),
      ),
    };
    const revokeApiKeyQueryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn(() => Promise.resolve({ affected: 1 })),
    };
    workspaceApiKeyRepository = {
      save: jest.fn((input) => Promise.resolve(input)),
      createQueryBuilder: jest.fn(() => revokeApiKeyQueryBuilder),
    };

    const dataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === OrganizationUserEntity)
          return organizationUserRepository;
        if (entity === OrganizationEntity) return organizationRepository;
        if (entity === WorkspaceEntity) return workspaceRepository;
        if (entity === WorkspacePlanEntity) return workspacePlanRepository;
        if (entity === WorkspaceApiKeyEntity) return workspaceApiKeyRepository;
        throw new Error('Unexpected repository');
      }),
      transaction: jest.fn((callback) => callback(dataSource)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<WorkspaceService>(WorkspaceService);
  });

  it('lists workspaces from organizations the user belongs to', async () => {
    organizationUserRepository.find.mockResolvedValue([
      {
        organization: {
          ...organization,
          workspaces: [workspace],
        },
      },
    ]);

    await expect(service.listWorkspaces('user-1')).resolves.toEqual([
      {
        id: workspace.id,
        name: workspace.name,
        plan: workspace.plan,
        organization: {
          id: organization.id,
          name: organization.name,
        },
        planConfig: undefined,
      },
    ]);
  });

  it('creates a workspace for organization managers', async () => {
    organizationUserRepository.findOne.mockResolvedValue({
      role: USER_PERMISSIONS.ADMIN,
    });
    organizationRepository.findOne.mockResolvedValue(organization);

    const result = await service.createWorkspace('user-1', {
      organizationId: organization.id,
      name: 'Staging',
    });

    expect(workspaceRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Staging',
        plan: WORKSPACE_PLANS.FREE,
        organization,
      }),
    );
    expect(result).toMatchObject({
      id: 'workspace-new',
      name: 'Staging',
      plan: WORKSPACE_PLANS.FREE,
      organization: {
        id: organization.id,
        name: organization.name,
      },
    });
    expect(result.apiKey).toMatch(/^lynx_/);
    expect(workspaceApiKeyRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        keyHash: expect.any(String),
        scopes: ['events:write'],
      }),
    );
  });

  it('blocks members from rotating workspace API keys', async () => {
    workspaceRepository.findOne.mockResolvedValue(workspace);
    organizationUserRepository.findOne.mockResolvedValue({
      role: USER_PERMISSIONS.MEMBER,
    });

    await expect(
      service.rotateApiKey(workspace.id, 'user-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(workspaceRepository.save).not.toHaveBeenCalled();
  });
});
