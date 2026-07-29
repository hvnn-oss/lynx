import type { IssueRecordRepository } from "./issue-record.repository.js";
import { IssueRecordService } from "./issue-record.service.js";
import type { IssueService } from "./issue.service.js";

describe("IssueRecordService", () => {
  it("stores the original record without evaluating it", async () => {
    const repository = {
      save: jest.fn().mockResolvedValue({
        record: { id: "4acb9bfb-36c7-49bc-bd69-13a930cff154" },
        processing: { status: "RECEIVED" },
        isNew: true,
      }),
    } as unknown as IssueRecordRepository;
    const service = new IssueRecordService(repository);

    await expect(
      service.receive({
        workspaceId: "workspace-1",
        environment: "production",
        sdkInstanceId: "sdk-instance-1",
        clientRecordId: "record-1",
        recordKind: "DETECTION",
        detectionType: "LOOP_DETECTED",
        runId: "run-1",
        sessionId: "session-1",
        eventId: "event-1",
        agentId: "agent-1",
        promptVersionId: "2a8df428-d6df-44b5-960f-345fa04f9a30",
        detectedAt: 1784800800000,
        payload: { loopCount: 3 },
        evidence: { spanIds: ["span-1"] },
      }),
    ).resolves.toEqual({
      recordId: "4acb9bfb-36c7-49bc-bd69-13a930cff154",
      status: "RECEIVED",
      isNew: true,
    });

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        environment: "production",
        clientAgentId: "agent-1",
        reportedPromptVersionId: "2a8df428-d6df-44b5-960f-345fa04f9a30",
        detectedAt: new Date(1784800800000),
      }),
    );
  });

  it("returns the current state for an idempotent duplicate", async () => {
    const repository = {
      save: jest.fn().mockResolvedValue({
        record: { id: "4acb9bfb-36c7-49bc-bd69-13a930cff154" },
        processing: { status: "EVALUATING" },
        isNew: false,
      }),
    } as unknown as IssueRecordRepository;
    const service = new IssueRecordService(repository);

    await expect(
      service.receive({
        workspaceId: "workspace-1",
        environment: "production",
        sdkInstanceId: "sdk-instance-1",
        clientRecordId: "record-1",
        recordKind: "DETECTION",
        detectionType: "FIREWALL_BLOCK",
        agentId: "agent-1",
        detectedAt: 1784800800000,
        payload: {},
      }),
    ).resolves.toMatchObject({
      status: "EVALUATING",
      isNew: false,
    });
  });

  it("evaluates a claimed loop record and records an issue occurrence", async () => {
    const record = {
      id: "4acb9bfb-36c7-49bc-bd69-13a930cff154",
      workspaceId: "70302e18-767c-42d3-9674-80c302475981",
      sdkInstanceId: "sdk-instance-1",
      recordKind: "DETECTION",
      detectionType: "LOOP_DETECTED",
      clientSessionId: "session-1",
      clientEventId: "event-1",
      clientAgentId: "agent-1",
      reportedPolicyId: null,
      reportedPromptVersionId: null,
      environment: "production",
      detectedAt: new Date("2026-07-24T00:00:00.000Z"),
      payload: { tools: ["search"] },
      evidence: { spanIds: ["span-1"] },
    };
    const repository = {
      claimNext: jest.fn().mockResolvedValue({
        record,
        processing: { attemptCount: 1 },
      }),
      resolveContext: jest.fn().mockResolvedValue({
        session: { id: "7b65c0a0-2fe0-41fa-ab2b-f66ba51490ae" },
        agent: { id: "0ea13b56-4257-49d8-86fd-6b812f920ddb" },
        event: { id: "f5760cca-8e5a-49b2-ad20-2ea02339e14b" },
      }),
      createEvaluation: jest.fn().mockResolvedValue({
        id: "5cc6c24f-8d91-40f3-8c2d-0dd2a50d5f4a",
      }),
      completeDecision: jest.fn().mockResolvedValue(undefined),
    } as unknown as IssueRecordRepository;
    const issues = {
      record: jest.fn().mockResolvedValue({
        issue: {
          id: "2e83787a-f2db-4491-9000-94db05906403",
          stableFingerprint: "a".repeat(64),
          exactFingerprint: "b".repeat(64),
        },
      }),
    } as unknown as IssueService;
    const service = new IssueRecordService(repository, issues);

    await expect(service.processNext()).resolves.toBe(true);

    expect(issues.record).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "LOOP",
        severity: "WARNING",
        sessionId: "7b65c0a0-2fe0-41fa-ab2b-f66ba51490ae",
        recordId: record.id,
        clientOccurrenceId: record.id,
        message: expect.objectContaining({
          titleKey: "issue.loop.detected.title",
        }),
      }),
    );
    expect(repository.completeDecision).toHaveBeenCalledWith(
      record.id,
      "5cc6c24f-8d91-40f3-8c2d-0dd2a50d5f4a",
      "2e83787a-f2db-4491-9000-94db05906403",
      { stable: "a".repeat(64), exact: "b".repeat(64) },
    );
  });

  it("defers evaluation until the referenced session is available", async () => {
    const repository = {
      claimNext: jest.fn().mockResolvedValue({
        record: {
          id: "4acb9bfb-36c7-49bc-bd69-13a930cff154",
          recordKind: "DETECTION",
        },
        processing: { attemptCount: 1 },
      }),
      resolveContext: jest.fn().mockResolvedValue({
        session: null,
        agent: null,
        event: null,
      }),
      defer: jest.fn().mockResolvedValue(undefined),
    } as unknown as IssueRecordRepository;
    const service = new IssueRecordService(repository);

    await expect(service.processNext()).resolves.toBe(true);
    expect(repository.defer).toHaveBeenCalledWith(
      "4acb9bfb-36c7-49bc-bd69-13a930cff154",
      expect.any(Date),
    );
  });
});
