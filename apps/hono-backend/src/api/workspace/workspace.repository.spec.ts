import {
  OrganizationEntity,
  OrganizationPlanEntity,
  WorkspaceEntity,
} from "@repo/database";
import type { EntityManager } from "typeorm";
import { WorkspaceRepository } from "./workspace.repository.js";

describe("WorkspaceRepository", () => {
  function createManager(maxWorkspaces: number | null, workspaceCount: number) {
    const organization = {
      id: "790f39ca-4bbb-4d6d-b0ec-e77bb16d0f27",
      planId: "790f39ca-4bbb-4d6d-b0ec-e77bb16d0f28",
    } as OrganizationEntity;
    const plan = {
      id: organization.planId,
      maxWorkspaces,
    } as OrganizationPlanEntity;
    const savedWorkspace = {
      id: "790f39ca-4bbb-4d6d-b0ec-e77bb16d0f29",
      name: "Production",
    } as WorkspaceEntity;
    const organizationQuery = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(organization),
    };
    const organizationRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(organizationQuery),
    };
    const planRepository = {
      findOneBy: jest.fn().mockResolvedValue(plan),
    };
    const workspaceRepository = {
      count: jest.fn().mockResolvedValue(workspaceCount),
      create: jest.fn().mockReturnValue(savedWorkspace),
      save: jest.fn().mockResolvedValue(savedWorkspace),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === OrganizationEntity) return organizationRepository;
        if (entity === OrganizationPlanEntity) return planRepository;
        if (entity === WorkspaceEntity) return workspaceRepository;
        throw new Error("UNEXPECTED_REPOSITORY");
      }),
    } as unknown as EntityManager;

    return {
      manager,
      organization,
      organizationQuery,
      planRepository,
      savedWorkspace,
      workspaceRepository,
    };
  }

  it("Free 요금제의 첫 워크스페이스 생성을 허용한다", async () => {
    const {
      manager,
      organization,
      organizationQuery,
      planRepository,
      savedWorkspace,
      workspaceRepository,
    } = createManager(1, 0);

    const repository = new WorkspaceRepository();
    await expect(
      repository.createWorkspace(manager, {
        orgId: organization.id,
        name: "Production",
      }),
    ).resolves.toBe(savedWorkspace);

    expect(organizationQuery.setLock).toHaveBeenCalledWith("pessimistic_write");
    expect(organizationQuery.where).toHaveBeenCalledWith(
      "organization.id = :orgId",
      { orgId: organization.id },
    );
    expect(planRepository.findOneBy).toHaveBeenCalledWith({
      id: organization.planId,
    });
    expect(workspaceRepository.count).toHaveBeenCalledWith({
      where: { organization: { id: organization.id } },
    });
    expect(workspaceRepository.create).toHaveBeenCalledWith({
      name: "Production",
      organization: expect.objectContaining({
        id: organization.id,
        plan: expect.objectContaining({ maxWorkspaces: 1 }),
      }),
    });
  });

  it("Free 요금제의 기존 워크스페이스가 1개면 추가 생성을 거부한다", async () => {
    const { manager, organization, workspaceRepository } = createManager(1, 1);
    const repository = new WorkspaceRepository();

    await expect(
      repository.createWorkspace(manager, {
        orgId: organization.id,
        name: "Second workspace",
      }),
    ).rejects.toMatchObject({
      status: 403,
      message: "PLAN_UPGRADE_REQUIRED",
    });
    expect(workspaceRepository.create).not.toHaveBeenCalled();
    expect(workspaceRepository.save).not.toHaveBeenCalled();
  });
});
