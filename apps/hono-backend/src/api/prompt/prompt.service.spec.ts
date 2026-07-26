import type { AccessControlService } from "../../common/access-control/access-control.service.js";
import { ConflictErrorException } from "../../common/exceptions/conflict.js";
import { runtimeConfigService } from "../openapi/runtime-config/runtime-config.service.js";
import type { PromptRepository } from "./prompt.repository.js";
import { PromptService } from "./prompt.service.js";

const workspaceId = "72adbb57-96ad-4d3d-a2dc-8faf071673e5";
const promptId = "c1821bc3-bf1e-46ef-b210-b9376a41cd0c";
const userId = "aa5d1f6b-173e-4b14-a42e-fc7077f8ea90";

function createPrompt() {
  return {
    id: promptId,
    name: "support-agent",
    description: "",
    draftContent: "You are helpful.",
    draftRevision: 3,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-02T00:00:00.000Z"),
  };
}

function createService(repositoryOverrides: Record<string, jest.Mock> = {}) {
  const repository = {
    find: jest.fn().mockResolvedValue(createPrompt()),
    update: jest.fn(),
    createVersion: jest.fn(),
    findVersion: jest.fn(),
    ...repositoryOverrides,
  } as unknown as PromptRepository;
  const accessControl = {
    assertWorkspaceCapability: jest.fn().mockResolvedValue(undefined),
  } as unknown as AccessControlService;
  return {
    service: new PromptService(repository, accessControl),
    repository,
    accessControl,
  };
}

describe("PromptService", () => {
  afterEach(() => jest.restoreAllMocks());

  it("rejects a stale draft revision during an optimistic update", async () => {
    const { service } = createService({
      update: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.update(userId, workspaceId, promptId, {
        expectedDraftRevision: 2,
        draftContent: "changed",
      }),
    ).rejects.toBeInstanceOf(ConflictErrorException);
  });

  it("creates an immutable version only from the current draft", async () => {
    const version = {
      id: "f78f96b3-a1bd-45ce-8b7f-0db424ddaa56",
      promptId,
      version: "v3",
      content: "You are helpful.",
      contentHash: "a".repeat(64),
      baseVersionId: null,
      changeReason: "release",
      createdByUserId: userId,
      draftRevision: 3,
      createdAt: new Date("2026-07-03T00:00:00.000Z"),
    };
    const createVersion = jest.fn().mockResolvedValue(version);
    const { service } = createService({ createVersion });

    await expect(
      service.createVersion(userId, workspaceId, promptId, {
        expectedDraftRevision: 3,
        version: "v3",
        content: "You are helpful.",
        changeReason: "release",
      }),
    ).resolves.toEqual(
      expect.objectContaining({ id: version.id, contentHash: "a".repeat(64) }),
    );
    expect(createVersion).toHaveBeenCalledWith(
      workspaceId,
      promptId,
      userId,
      expect.objectContaining({ expectedDraftRevision: 3 }),
    );
  });

  it("invalidates every target cache after a deployment", async () => {
    const version = {
      id: "f78f96b3-a1bd-45ce-8b7f-0db424ddaa56",
      version: "v3",
    };
    const deployment = {
      id: "675a2136-57fd-44af-8e1e-c77a7d2034c8",
      promptId,
      versionId: version.id,
      environment: "production",
      agentId: null,
      active: true,
      supersedesDeploymentId: null,
      reason: null,
      deployedAt: new Date("2026-07-03T00:00:00.000Z"),
      deployedByUserId: userId,
    };
    const deploy = jest.fn().mockResolvedValue({
      kind: "DEPLOYED",
      deployment,
      version,
    });
    const invalidate = jest
      .spyOn(runtimeConfigService, "invalidate")
      .mockImplementation();
    const { service } = createService({ deploy });

    await service.deploy(userId, workspaceId, promptId, {
      versionId: version.id,
      environment: "production",
    });

    expect(invalidate).toHaveBeenCalledWith(workspaceId);
  });
});
