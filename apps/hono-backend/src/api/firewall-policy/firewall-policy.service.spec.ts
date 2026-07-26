import type { FirewallPolicyEntity } from "@repo/database";
import type { AccessControlService } from "../../common/access-control/access-control.service.js";
import { BadRequestErrorException } from "../../common/exceptions/bad-request.js";
import type { FirewallPolicyRepository } from "./firewall-policy.repository.js";
import { FirewallPolicyService } from "./firewall-policy.service.js";

describe("FirewallPolicyService", () => {
  const workspaceId = "14ec8c0d-bdff-4375-ac32-fac5577238d7";
  const userId = "7cdd6248-926c-4414-b71c-a8c819643021";

  function policy(overrides: Partial<FirewallPolicyEntity> = {}) {
    return {
      id: 7,
      name: "Block destructive tools",
      description: null,
      condition: "tool.riskLevel == 'CRITICAL'",
      severity: "CRITICAL",
      action: "BLOCK",
      version: "v1",
      activated: false,
      draftRevision: 1,
      deployedRevision: null,
      deletedAt: null,
      createdAt: new Date("2026-07-25T00:00:00.000Z"),
      updatedAt: new Date("2026-07-25T00:00:00.000Z"),
      ...overrides,
    } as FirewallPolicyEntity;
  }

  function dependencies(current = policy()) {
    const repository = {
      list: jest.fn().mockResolvedValue([current]),
      find: jest.fn().mockResolvedValue(current),
      create: jest.fn().mockResolvedValue(current),
      update: jest.fn().mockImplementation(async (entity, body) => ({
        ...entity,
        ...body,
        draftRevision: entity.draftRevision + 1,
      })),
      deploy: jest.fn().mockResolvedValue({
        ...current,
        activated: true,
        deployedRevision: current.draftRevision,
      }),
      findRevision: jest.fn().mockResolvedValue({
        policyId: String(current.id),
        revision: 1,
      }),
      rollback: jest.fn().mockResolvedValue({
        ...current,
        activated: true,
        deployedRevision: 1,
      }),
      setActivated: jest.fn().mockImplementation(async (entity, activated) => ({
        ...entity,
        activated,
      })),
      softDelete: jest.fn(),
    } as unknown as FirewallPolicyRepository;
    const accessControl = {
      assertWorkspaceCapability: jest.fn(),
    } as unknown as AccessControlService;
    return {
      repository,
      accessControl,
      service: new FirewallPolicyService(repository, accessControl),
    };
  }

  it("수정한 초안은 별도 리비전으로 표시하고 즉시 배포하지 않는다", async () => {
    const { service, repository } = dependencies();

    const result = await service.update(userId, workspaceId, 7, {
      condition: "input.amount > 1000",
      version: "v2",
    });

    expect(result.policy).toEqual(
      expect.objectContaining({
        condition: "input.amount > 1000",
        draftRevision: 2,
        deployedRevision: null,
        isDirty: true,
      }),
    );
    expect(repository.update).toHaveBeenCalled();
    expect(repository.deploy).not.toHaveBeenCalled();
  });

  it("배포되지 않은 정책은 activate로 우회할 수 없다", async () => {
    const { service } = dependencies();

    await expect(
      service.activate(userId, workspaceId, 7),
    ).rejects.toBeInstanceOf(BadRequestErrorException);
  });

  it("시뮬레이션은 SDK 조건 문법으로 현재 초안을 평가한다", async () => {
    const { service } = dependencies();

    await expect(
      service.simulate(userId, workspaceId, 7, {
        tool: { name: "delete_user", riskLevel: "CRITICAL" },
        input: {},
      }),
    ).resolves.toEqual({
      matched: true,
      action: "BLOCK",
      severity: "CRITICAL",
      policyId: "7",
      version: "v1",
      revision: 1,
    });
  });

  it("지원하지 않는 조건은 저장 전에 거절한다", async () => {
    const { service } = dependencies();

    await expect(
      service.create(userId, workspaceId, {
        name: "Unsafe expression",
        condition: "globalThis.process.exit()",
        severity: "HIGH",
        action: "BLOCK",
        version: "v1",
      }),
    ).rejects.toBeInstanceOf(BadRequestErrorException);
  });
});
