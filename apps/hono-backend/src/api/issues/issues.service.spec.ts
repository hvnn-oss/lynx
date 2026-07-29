import type { IssueEntity } from "@repo/database";
import type { AccessControlService } from "../../common/access-control/access-control.service.js";
import type { IssuesRepository } from "./issues.repository.js";
import { IssuesService } from "./issues.service.js";

describe("IssuesService", () => {
  it("checks workspace access and returns a bounded cursor page", async () => {
    const accessControl = {
      assertWorkspaceCapability: jest.fn().mockResolvedValue({}),
    } as unknown as AccessControlService;
    const repository = {
      list: jest
        .fn()
        .mockResolvedValue([
          createIssue("00000000-0000-4000-8000-000000000003", 3),
          createIssue("00000000-0000-4000-8000-000000000002", 2),
          createIssue("00000000-0000-4000-8000-000000000001", 1),
        ]),
    } as unknown as IssuesRepository;
    const service = new IssuesService(repository, accessControl);

    const result = await service.getIssues({
      userId: "user-1",
      workspaceId: "workspace-1",
      query: { limit: 2 },
    });

    expect(accessControl.assertWorkspaceCapability).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        workspaceId: "workspace-1",
      }),
    );
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.fingerprint).toBe("a".repeat(64));
    expect(result.nextCursor).toBe(
      "2026-07-24T00:00:02.000Z|00000000-0000-4000-8000-000000000002",
    );
  });

  it("maps issue details and related managed configuration", async () => {
    const accessControl = createAccessControl();
    const issue = createIssue("00000000-0000-4000-8000-000000000003", 3);
    Object.assign(issue, {
      source: "SDK",
      stableFingerprint: "a".repeat(64),
      exactFingerprint: "b".repeat(64),
      exactFingerprintVersion: "v1",
      policy: { id: 17, name: "Block risky tools", version: "v2" },
      representativePromptVersion: {
        id: "00000000-0000-4000-8000-000000000020",
        version: "v3",
      },
      resolvedAt: null,
    });
    const repository = {
      findIssue: jest.fn().mockResolvedValue(issue),
    } as unknown as IssuesRepository;
    const service = new IssuesService(repository, accessControl);

    const result = await service.getIssue({
      userId: "user-1",
      workspaceId: "workspace-1",
      issueId: issue.id,
    });

    expect(result.policy).toEqual({
      id: "17",
      name: "Block risky tools",
      version: "v2",
    });
    expect(result.fingerprint.exact).toBe("b".repeat(64));
  });

  it("renders a structured firewall title in the requested locale", async () => {
    const issue = createIssue("00000000-0000-4000-8000-000000000003", 3);
    Object.assign(issue, {
      titleKey: "issue.firewall.block.title",
      summaryKey: "issue.firewall.block.summary",
      messageParams: {
        toolName: "deleteFile",
        policyName: "Destructive tool policy",
        condition: "tool.riskLevel == HIGH",
      },
    });
    const repository = {
      list: jest.fn().mockResolvedValue([issue]),
    } as unknown as IssuesRepository;
    const service = new IssuesService(repository, createAccessControl());

    const result = await service.getIssues({
      userId: "user-1",
      workspaceId: "workspace-1",
      query: { limit: 25 },
      locale: "ko",
    });

    expect(result.items[0]?.title).toBe(
      "deleteFile 호출 차단 — ‘Destructive tool policy’ 정책 (도구 위험도 = HIGH)",
    );
    expect(result.items[0]?.message).toEqual({
      titleKey: "issue.firewall.block.title",
      summaryKey: "issue.firewall.block.summary",
      params: issue.messageParams,
    });
  });

  it("normalizes database summary counts", async () => {
    const repository = {
      getSummary: jest.fn().mockResolvedValue({
        issues: {
          total: "8",
          open: "3",
          investigating: "1",
          resolved: "3",
          ignored: "1",
          critical: "2",
          warning: "5",
          info: "1",
          newIssues: "4",
        },
        occurrences: {
          occurrences: "13",
          blockedOccurrences: "6",
          affectedSessions: "7",
        },
        reopenedIssues: "2",
      }),
    } as unknown as IssuesRepository;
    const service = new IssuesService(repository, createAccessControl());

    const result = await service.getSummary({
      userId: "user-1",
      workspaceId: "workspace-1",
      query: {},
    });

    expect(result).toMatchObject({
      total: 8,
      reopenedIssues: 2,
      occurrences: 13,
      blockedOccurrences: 6,
      affectedSessions: 7,
    });
  });

  it("returns Issue Record processing health and the latest decision", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-27T01:00:00.000Z"));
    const repository = {
      listRecordProcessing: jest.fn().mockResolvedValue([
        {
          recordId: "00000000-0000-4000-8000-000000000041",
          status: "FAILED",
          attemptCount: 3,
          lastErrorCode: "EVALUATOR_FAILED",
          nextEvaluationAt: null,
          updatedAt: new Date("2026-07-27T00:50:00.000Z"),
          record: {
            id: "00000000-0000-4000-8000-000000000041",
            recordKind: "DETECTION",
            detectionType: "LOOP_DETECTED",
            sdkInstanceId: "sdk-1",
            clientAgentId: "support-agent",
            clientRunId: "run-1",
            clientSessionId: "session-1",
            environment: "production",
            detectedAt: new Date("2026-07-27T00:49:00.000Z"),
            createdAt: new Date("2026-07-27T00:49:01.000Z"),
          },
        },
        {
          recordId: "00000000-0000-4000-8000-000000000040",
          status: "RECEIVED",
          attemptCount: 0,
          lastErrorCode: null,
          nextEvaluationAt: null,
          updatedAt: new Date("2026-07-27T00:40:00.000Z"),
          record: {
            id: "00000000-0000-4000-8000-000000000040",
            recordKind: "DETECTION",
            detectionType: "MODEL_ERROR",
            sdkInstanceId: "sdk-1",
            clientAgentId: "support-agent",
            clientRunId: "run-2",
            clientSessionId: "session-2",
            environment: "production",
            detectedAt: new Date("2026-07-27T00:39:00.000Z"),
            createdAt: new Date("2026-07-27T00:39:01.000Z"),
          },
        },
      ]),
      getRecordProcessingSummary: jest.fn().mockResolvedValue({
        received: "1",
        evaluating: "0",
        decided: "8",
        failed: "1",
        recoveryPending: "1",
        deferred: "1",
        delayed: "1",
        unsupported: "2",
      }),
      listRecordEvaluations: jest.fn().mockResolvedValue([
        {
          recordId: "00000000-0000-4000-8000-000000000041",
          action: "CREATE",
          reasonCode: "LOOP_THRESHOLD",
          summary: "A loop threshold was exceeded.",
          confidence: 1,
          matchedIssueId: "00000000-0000-4000-8000-000000000042",
          createdAt: new Date("2026-07-27T00:49:02.000Z"),
        },
      ]),
    } as unknown as IssuesRepository;
    const service = new IssuesService(repository, createAccessControl());

    const result = await service.getIssueRecords({
      userId: "user-1",
      workspaceId: "workspace-1",
      query: { limit: 1 },
    });

    expect(result.summary).toEqual({
      received: 1,
      evaluating: 0,
      decided: 8,
      failed: 1,
      recoveryPending: 1,
      deferred: 1,
      delayed: 1,
      unsupported: 2,
    });
    expect(result.nextCursor).toBe(
      "2026-07-27T00:49:00.000Z|00000000-0000-4000-8000-000000000041",
    );
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        detectionType: "LOOP_DETECTED",
        processing: expect.objectContaining({
          status: "FAILED",
          isDelayed: true,
        }),
        decision: expect.objectContaining({
          matchedIssueId: "00000000-0000-4000-8000-000000000042",
        }),
      }),
    );
    jest.useRealTimers();
  });

  it("returns comments and change events as one cursor timeline", async () => {
    const issue = createIssue("00000000-0000-4000-8000-000000000003", 3);
    const activities = [
      createActivity("00000000-0000-4000-8000-000000000052", 2, "COMMENTED"),
      createActivity(
        "00000000-0000-4000-8000-000000000051",
        1,
        "STATUS_CHANGED",
      ),
    ];
    const repository = {
      findIssue: jest.fn().mockResolvedValue(issue),
      listActivities: jest.fn().mockResolvedValue(activities),
    } as unknown as IssuesRepository;
    const service = new IssuesService(repository, createAccessControl());

    const result = await service.getActivities({
      userId: "user-1",
      workspaceId: "workspace-1",
      issueId: issue.id,
      query: { limit: 1 },
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      type: "COMMENTED",
      actor: { name: "Operator" },
      body: "I found the failing tool call.",
    });
    expect(result.nextCursor).toBe(
      "2026-07-27T00:00:02.000Z|00000000-0000-4000-8000-000000000052",
    );
  });

  it("requires update permission and stores a comment Activity", async () => {
    const accessControl = createAccessControl();
    const activity = createActivity(
      "00000000-0000-4000-8000-000000000053",
      3,
      "COMMENTED",
    );
    const repository = {
      createComment: jest.fn().mockResolvedValue(activity),
    } as unknown as IssuesRepository;
    const service = new IssuesService(repository, accessControl);

    const result = await service.createComment({
      userId: "00000000-0000-4000-8000-000000000030",
      workspaceId: "workspace-1",
      issueId: "00000000-0000-4000-8000-000000000003",
      body: {
        body: "I found the failing tool call.",
        mentionedUserIds: [],
      },
    });

    expect(accessControl.assertWorkspaceCapability).toHaveBeenCalled();
    expect(repository.createComment).toHaveBeenCalledWith(
      expect.objectContaining({ body: "I found the failing tool call." }),
    );
    expect(result.type).toBe("COMMENTED");
  });

  it("updates mentions and exposes edit permissions only to the author", async () => {
    const authorId = "00000000-0000-4000-8000-000000000030";
    const mentionedUserId = "00000000-0000-4000-8000-000000000031";
    const activity = {
      ...createActivity("00000000-0000-4000-8000-000000000054", 4, "COMMENTED"),
      actorUserId: authorId,
      body: "@Reviewer please verify this.",
      editedAt: new Date("2026-07-27T00:01:00.000Z"),
      metadata: {
        mentions: [{ userId: mentionedUserId, name: "Reviewer" }],
      },
    };
    const repository = {
      updateComment: jest.fn().mockResolvedValue(activity),
    } as unknown as IssuesRepository;
    const service = new IssuesService(repository, createAccessControl());

    const result = await service.updateComment({
      userId: authorId,
      workspaceId: "workspace-1",
      issueId: "00000000-0000-4000-8000-000000000003",
      commentId: activity.id,
      body: {
        body: "@Reviewer please verify this.",
        mentionedUserIds: [mentionedUserId],
      },
    });

    expect(result.mentions).toEqual([
      { userId: mentionedUserId, name: "Reviewer" },
    ]);
    expect(result.permissions).toEqual({ canEdit: true, canDelete: true });
    expect(result.editedAt).toBe("2026-07-27T00:01:00.000Z");
  });

  it("replaces assignees and returns the latest collaboration state", async () => {
    const repository = {
      updateAssignees: jest.fn().mockResolvedValue(undefined),
      getAssignees: jest.fn().mockResolvedValue({
        assignees: [
          {
            userId: "00000000-0000-4000-8000-000000000031",
            membership: {
              user: {
                id: "00000000-0000-4000-8000-000000000031",
                name: "Investigator",
                email: "investigator@example.com",
              },
            },
          },
        ],
        availableUsers: [
          {
            role: "MEMBER",
            user: {
              id: "00000000-0000-4000-8000-000000000031",
              name: "Investigator",
              email: "investigator@example.com",
            },
          },
        ],
      }),
    } as unknown as IssuesRepository;
    const service = new IssuesService(repository, createAccessControl());

    const result = await service.updateAssignees({
      userId: "00000000-0000-4000-8000-000000000030",
      workspaceId: "workspace-1",
      issueId: "00000000-0000-4000-8000-000000000003",
      body: { userIds: ["00000000-0000-4000-8000-000000000031"] },
    });

    expect(repository.updateAssignees).toHaveBeenCalledWith(
      expect.objectContaining({
        assigneeUserIds: ["00000000-0000-4000-8000-000000000031"],
      }),
    );
    expect(result.assignees[0]?.name).toBe("Investigator");
  });

  it("requires workspace update permission before changing status", async () => {
    const accessControl = createAccessControl();
    const issue = createIssue("00000000-0000-4000-8000-000000000003", 3);
    Object.assign(issue, {
      status: "RESOLVED",
      resolvedAt: new Date("2026-07-24T01:00:00.000Z"),
      resolvedByUser: {
        id: "00000000-0000-4000-8000-000000000030",
        name: "Operator",
      },
      updatedAt: new Date("2026-07-24T01:00:00.000Z"),
    });
    const repository = {
      updateStatus: jest.fn().mockResolvedValue(issue),
    } as unknown as IssuesRepository;
    const service = new IssuesService(repository, accessControl);

    const result = await service.updateStatus({
      userId: "user-1",
      workspaceId: "workspace-1",
      issueId: issue.id,
      body: { status: "RESOLVED", reason: "Fixed" },
    });

    expect(accessControl.assertWorkspaceCapability).toHaveBeenCalled();
    expect(result.status).toBe("RESOLVED");
    expect(result.resolvedBy?.name).toBe("Operator");
  });
});

function createAccessControl(): AccessControlService {
  return {
    assertWorkspaceCapability: jest.fn().mockResolvedValue({}),
  } as unknown as AccessControlService;
}

function createActivity(
  id: string,
  second: number,
  type: "COMMENTED" | "STATUS_CHANGED",
) {
  return {
    id,
    type,
    actorType: "USER",
    actorUserId: "00000000-0000-4000-8000-000000000030",
    actorName: "Operator",
    body: type === "COMMENTED" ? "I found the failing tool call." : null,
    editedAt: null,
    deletedAt: null,
    metadata:
      type === "STATUS_CHANGED"
        ? { previousStatus: "OPEN", nextStatus: "INVESTIGATING" }
        : null,
    createdAt: new Date(`2026-07-27T00:00:0${second}.000Z`),
  };
}

function createIssue(id: string, second: number): IssueEntity {
  return {
    id,
    title: "Firewall blocked an action",
    summary: "A risky tool call was blocked.",
    titleKey: null,
    summaryKey: null,
    messageParams: null,
    category: "FIREWALL",
    severity: "CRITICAL",
    status: "OPEN",
    environment: "production",
    agent: {
      id: "00000000-0000-4000-8000-000000000010",
      name: "support-agent",
    },
    occurrenceCount: 3,
    affectedSessionCount: 2,
    blockedOccurrenceCount: 3,
    stableFingerprint: "a".repeat(64),
    firstSeenAt: new Date("2026-07-23T00:00:00.000Z"),
    lastSeenAt: new Date(`2026-07-24T00:00:0${second}.000Z`),
  } as IssueEntity;
}
