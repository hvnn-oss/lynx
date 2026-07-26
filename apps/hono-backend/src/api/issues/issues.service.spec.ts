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

function createIssue(id: string, second: number): IssueEntity {
  return {
    id,
    title: "Firewall blocked an action",
    summary: "A risky tool call was blocked.",
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
    firstSeenAt: new Date("2026-07-23T00:00:00.000Z"),
    lastSeenAt: new Date(`2026-07-24T00:00:0${second}.000Z`),
  } as IssueEntity;
}
