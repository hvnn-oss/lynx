import type { AccessControlService } from "../../common/access-control/access-control.service.js";
import { BadRequestErrorException } from "../../common/exceptions/bad-request.js";
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

  it("returns cursor-paged prompts with latest version and active deployment summaries", async () => {
    const secondPrompt = {
      ...createPrompt(),
      id: "03ce312d-a8f3-4784-9454-cb3c6d5f59fc",
      updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    };
    const list = jest.fn().mockResolvedValue([createPrompt(), secondPrompt]);
    const listLatestVersions = jest.fn().mockResolvedValue([
      {
        id: "f78f96b3-a1bd-45ce-8b7f-0db424ddaa56",
        promptId,
        version: "v3",
        draftRevision: 3,
        createdAt: new Date("2026-07-03T00:00:00.000Z"),
      },
    ]);
    const listActiveDeployments = jest.fn().mockResolvedValue([
      {
        id: "675a2136-57fd-44af-8e1e-c77a7d2034c8",
        promptId,
        versionId: "f78f96b3-a1bd-45ce-8b7f-0db424ddaa56",
        version: { version: "v3" },
        environment: "staging",
        agentId: null,
        agent: null,
        deployedAt: new Date("2026-07-04T00:00:00.000Z"),
      },
    ]);
    const { service } = createService({
      list,
      listLatestVersions,
      listActiveDeployments,
    });

    const result = await service.list(userId, workspaceId, {
      deployment: "ALL",
      limit: 1,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        latestVersion: expect.objectContaining({ version: "v3" }),
        activeDeployments: [
          expect.objectContaining({
            environment: "staging",
            version: "v3",
          }),
        ],
      }),
    );
    expect(result.nextCursor).toBe(
      "2026-07-02T00:00:00.000Z|c1821bc3-bf1e-46ef-b210-b9376a41cd0c",
    );
  });

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

  it("reports SDK pull refresh behavior without claiming per-instance acknowledgement", async () => {
    const getOperationsSummary = jest.fn().mockResolvedValue({
      promptCount: 3,
      versionCount: 8,
      activeDeploymentCount: 2,
      activeExperimentCount: 1,
      changeImpactIssueCount: 4,
      changedAt: new Date("2026-07-04T00:00:00.000Z"),
    });
    const { service } = createService({ getOperationsSummary });

    await expect(
      service.getOperationsSummary(userId, workspaceId),
    ).resolves.toEqual(
      expect.objectContaining({
        promptCount: 3,
        lastConfigurationChangedAt: "2026-07-04T00:00:00.000Z",
        sdkConfig: expect.objectContaining({
          delivery: "PULL",
          defaultRefreshIntervalMs: 60_000,
          acknowledgementTracking: false,
        }),
      }),
    );
  });

  it("requires a matching active deployment before starting an experiment", async () => {
    const { service } = createService({
      findActiveDeployment: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.createExperiment(userId, workspaceId, promptId, {
        name: "v2 test",
        environment: "staging",
        variants: [
          {
            versionId: "f78f96b3-a1bd-45ce-8b7f-0db424ddaa56",
            weight: 50,
          },
          {
            versionId: "af504555-b0f3-4b37-82b7-b9572eb51754",
            weight: 50,
          },
        ],
        activate: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestErrorException);
  });

  it("reports only metrics attributed to each experiment exposure", async () => {
    const experimentId = "a247c152-3277-4c91-9b22-95cb7a459d1e";
    const versionId = "f78f96b3-a1bd-45ce-8b7f-0db424ddaa56";
    const experiment = {
      id: experimentId,
      workspaceId,
      promptId,
      name: "support test",
      environment: "production",
      agentId: null,
      variants: [{ versionId, weight: 100 }],
      status: "ACTIVE",
      assignmentSalt: "salt",
      createdByUserId: userId,
      createdAt: new Date("2026-07-03T00:00:00.000Z"),
      startedAt: new Date("2026-07-03T00:00:00.000Z"),
      endedAt: null,
      prompt: createPrompt(),
      agent: null,
    };
    const { service } = createService({
      listExperimentOperations: jest.fn().mockResolvedValue([experiment]),
      listVersionsByIds: jest
        .fn()
        .mockResolvedValue([{ id: versionId, version: "v3" }]),
      getExperimentMetricsBatch: jest.fn().mockResolvedValue([
        {
          experimentId,
          versionId,
          runCount: "10",
          resolvedRunCount: "8",
          pendingRunCount: "2",
          successCount: "6",
          errorRunCount: "2",
          totalCost: "4",
          totalLatencyMs: "8000",
        },
      ]),
      countChangeImpactIssuesByVersion: jest.fn().mockResolvedValue([]),
    });

    const result = await service.listExperimentOperations(userId, workspaceId, {
      limit: 25,
    });

    expect(result.items[0]?.variants[0]?.metrics).toEqual({
      runCount: 10,
      resolvedRunCount: 8,
      pendingRunCount: 2,
      actualWeight: 1,
      successRate: 0.75,
      errorRate: 0.25,
      totalCost: 4,
      averageCost: 0.4,
      averageLatencyMs: 1000,
    });
  });

  it("does not reactivate a completed experiment", async () => {
    const { service } = createService({
      findExperiment: jest.fn().mockResolvedValue({
        id: "a247c152-3277-4c91-9b22-95cb7a459d1e",
        workspaceId,
        promptId,
        status: "COMPLETED",
        environment: "production",
        agentId: null,
      }),
    });

    await expect(
      service.updateExperimentStatus(
        userId,
        workspaceId,
        promptId,
        "a247c152-3277-4c91-9b22-95cb7a459d1e",
        "ACTIVE",
      ),
    ).rejects.toBeInstanceOf(BadRequestErrorException);
  });
});
