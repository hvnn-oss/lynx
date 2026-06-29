import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  OrganizationEntity,
  OrganizationUserEntity,
  UserEntity,
} from '@repo/database';
import { USER_PERMISSIONS } from '@repo/constants';
import { DataSource } from 'typeorm';
import { OrganizationService } from './organization.service';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let organizationRepository: {
    create: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  let membershipRepository: {
    create: jest.Mock;
    count: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
    save: jest.Mock;
  };
  let userRepository: {
    findOne: jest.Mock;
  };

  const owner = {
    id: 'user-owner',
    email: 'owner@example.com',
    name: 'Owner',
  } as UserEntity;
  const organization = {
    id: 'org-1',
    name: 'Acme',
    users: [],
    workspaces: [],
  } as unknown as OrganizationEntity;

  beforeEach(async () => {
    organizationRepository = {
      create: jest.fn((input) => ({ id: 'org-new', ...input })),
      findOne: jest.fn(),
      save: jest.fn((input) => Promise.resolve(input)),
      remove: jest.fn((input) => Promise.resolve(input)),
    };
    membershipRepository = {
      create: jest.fn((input) => input),
      count: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn((input) => Promise.resolve(input)),
      save: jest.fn((input) => Promise.resolve(input)),
    };
    userRepository = {
      findOne: jest.fn(),
    };

    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === OrganizationEntity) return organizationRepository;
        if (entity === OrganizationUserEntity) return membershipRepository;
        if (entity === UserEntity) return userRepository;
        throw new Error('Unexpected transactional repository');
      }),
    };

    const dataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === OrganizationEntity) return organizationRepository;
        if (entity === OrganizationUserEntity) return membershipRepository;
        if (entity === UserEntity) return userRepository;
        throw new Error('Unexpected repository');
      }),
      transaction: jest.fn((callback) => Promise.resolve(callback(manager))),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
  });

  it('creates an organization and owner membership in one transaction', async () => {
    userRepository.findOne.mockResolvedValue(owner);

    const result = await service.createOrganization(owner.id, {
      name: 'Acme',
    });

    expect(organizationRepository.create).toHaveBeenCalledWith({
      name: 'Acme',
    });
    expect(membershipRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user: owner,
        role: USER_PERMISSIONS.OWNER,
      }),
    );
    expect(result).toMatchObject({
      id: 'org-new',
      name: 'Acme',
      role: USER_PERMISSIONS.OWNER,
      members: [
        {
          userId: owner.id,
          email: owner.email,
          name: owner.name,
          role: USER_PERMISSIONS.OWNER,
        },
      ],
      workspaces: [],
    });
  });

  it('blocks members from adding organization members', async () => {
    membershipRepository.findOne.mockResolvedValue({
      role: USER_PERMISSIONS.MEMBER,
      organization,
      user: owner,
    });

    await expect(
      service.addMember(organization.id, owner.id, {
        email: 'new@example.com',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps at least one organization owner', async () => {
    membershipRepository.findOne
      .mockResolvedValueOnce({
        role: USER_PERMISSIONS.OWNER,
        organization,
        user: owner,
      })
      .mockResolvedValueOnce({
        role: USER_PERMISSIONS.OWNER,
        organization,
        user: owner,
      })
      .mockResolvedValueOnce({
        role: USER_PERMISSIONS.OWNER,
        organization,
        user: owner,
      });
    membershipRepository.count.mockResolvedValue(1);

    await expect(
      service.updateMemberRole(organization.id, owner.id, owner.id, {
        role: USER_PERMISSIONS.ADMIN,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(membershipRepository.save).not.toHaveBeenCalled();
  });
});
