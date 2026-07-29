import {
  OrganizationEntity,
  OrganizationPlanEntity,
  WorkspaceEntity,
} from "@repo/database";
import type { EntityManager } from "typeorm";
import { AppDataSource } from "../../provider/database/typeorm-config.js";
import { WorkspaceRepository } from "./workspace.repository.js";

jest.mock("../../provider/database/typeorm-config.js", () => ({
  AppDataSource: {
    transaction: jest.fn(),
  },
}));

describe("WorkspaceRepository", () => {
  it("조직 행만 잠그고 요금제는 별도로 조회해 워크스페이스를 생성한다", async () => {
    const organization = {
      id: "790f39ca-4bbb-4d6d-b0ec-e77bb16d0f27",
      planId: "790f39ca-4bbb-4d6d-b0ec-e77bb16d0f28",
    } as OrganizationEntity;
    const plan = {
      id: organization.planId,
      maxWorkspaces: 3,
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
      countBy: jest.fn().mockResolvedValue(0),
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
    jest
      .mocked(AppDataSource.transaction)
      .mockImplementation(async (work) => work(manager));

    const repository = new WorkspaceRepository();
    await expect(
      repository.createWorkspace({
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
    expect(workspaceRepository.create).toHaveBeenCalledWith({
      name: "Production",
      organization: { ...organization, plan },
    });
  });
});
