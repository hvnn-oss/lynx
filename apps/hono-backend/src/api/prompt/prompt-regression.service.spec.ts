import type { IssueRecordService } from "../openapi/issue-record/issue-record.service.js";
import type { PromptRepository } from "./prompt.repository.js";
import { PromptRegressionService } from "./prompt-regression.service.js";

const workspaceId = "72adbb57-96ad-4d3d-a2dc-8faf071673e5";
const versionId = "c1821bc3-bf1e-46ef-b210-b9376a41cd0c";
const baseVersionId = "aa5d1f6b-173e-4b14-a42e-fc7077f8ea90";

describe("PromptRegressionService", () => {
  it("creates a deterministic evaluation record when a version regresses", async () => {
    const prompts = {
      findVersionById: jest.fn().mockResolvedValue({
        id: versionId,
        promptId: "f78f96b3-a1bd-45ce-8b7f-0db424ddaa56",
        baseVersionId,
      }),
      getVersionMetrics: jest
        .fn()
        .mockResolvedValueOnce({
          runCount: "30",
          successCount: "18",
          errorRunCount: "9",
          totalCost: "60",
        })
        .mockResolvedValueOnce({
          runCount: "30",
          successCount: "27",
          errorRunCount: "2",
          totalCost: "30",
        }),
    } as unknown as PromptRepository;
    const issueRecords = {
      receive: jest.fn().mockResolvedValue({
        recordId: "record-1",
        status: "RECEIVED",
        isNew: true,
      }),
    } as unknown as IssueRecordService;
    const service = new PromptRegressionService(prompts, issueRecords);

    await service.detect({
      workspaceId,
      environment: "production",
      resolvedAgentId: "675a2136-57fd-44af-8e1e-c77a7d2034c8",
      event: {
        eventId: "event-1",
        clientId: "sdk-1",
        runId: "run-1",
        sessionId: "session-1",
        agentName: "support",
        eventType: "SESSION_OUTCOME",
        label: "outcome",
        timestamp: Date.now(),
        payload: { promptVersionIds: [versionId] },
      },
    });

    expect(issueRecords.receive).toHaveBeenCalledWith(
      expect.objectContaining({
        clientRecordId: `prompt-regression:${versionId}:run-1`,
        detectionType: "PROMPT_REGRESSION",
        promptVersionId: versionId,
      }),
    );
  });

  it("waits for enough runs before reporting a regression", async () => {
    const prompts = {
      findVersionById: jest.fn().mockResolvedValue({
        id: versionId,
        baseVersionId,
      }),
      getVersionMetrics: jest.fn().mockResolvedValue({
        runCount: "5",
        successCount: "0",
        errorRunCount: "5",
        totalCost: "100",
      }),
    } as unknown as PromptRepository;
    const issueRecords = {
      receive: jest.fn(),
    } as unknown as IssueRecordService;

    await new PromptRegressionService(prompts, issueRecords).detect({
      workspaceId,
      environment: "production",
      resolvedAgentId: "675a2136-57fd-44af-8e1e-c77a7d2034c8",
      event: {
        eventId: "event-2",
        clientId: "sdk-1",
        runId: "run-2",
        agentName: "support",
        eventType: "SESSION_OUTCOME",
        label: "outcome",
        timestamp: Date.now(),
        payload: { promptVersionIds: [versionId] },
      },
    });

    expect(issueRecords.receive).not.toHaveBeenCalled();
  });
});
