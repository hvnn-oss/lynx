import {
  ISSUE_ACTOR_TYPE,
  ISSUE_CATEGORY,
  ISSUE_SEVERITY,
  ISSUE_SOURCE,
} from "@repo/constants";
import type { IssueRepository } from "./issue.repository.js";
import { IssueService } from "./issue.service.js";
import type { RecordIssueInput } from "../../common/types/issue.js";

function input(
  overrides: Partial<RecordIssueInput> = {},
): RecordIssueInput {
  return {
    workspaceId: "workspace-1",
    title: "Approval missing",
    summary: "A refund tool call was blocked before execution.",
    category: ISSUE_CATEGORY.GUARDRAIL,
    severity: ISSUE_SEVERITY.CRITICAL,
    source: ISSUE_SOURCE.POLICY,
    environment: "production",
    agentId: "agent-1",
    policyId: "42",
    sessionId: "session-1",
    eventId: "event-1",
    isBlocked: true,
    detectedAt: new Date("2026-07-23T10:00:00.000Z"),
    detectorVersion: "guardrail-v1",
    clientOccurrenceId: "occurrence-1",
    reporter: {
      type: ISSUE_ACTOR_TYPE.SDK,
      name: "lynx-sdk",
    },
    fingerprint: {
      detectorType: "guardrail",
      tools: ["refundInvoice"],
      failedTool: "refundInvoice",
      reasonCode: "APPROVAL_MISSING",
      policyId: "42",
      policyVersion: "3",
    },
    ...overrides,
  };
}

describe("IssueService", () => {
  it("creates the fingerprint and supplies safe collection defaults", async () => {
    const result = { issue: { id: "issue-1" } };
    const repository = {
      record: jest.fn().mockResolvedValue(result),
    } as unknown as IssueRepository;
    const service = new IssueService(repository);

    await expect(service.record(input())).resolves.toBe(result);
    expect(repository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        stableFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
        exactFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
        riskSignals: [],
        reproductionSteps: [],
        tags: [],
      }),
    );
  });

  it("generates the same fingerprint when tool order differs", async () => {
    const repository = {
      record: jest.fn().mockResolvedValue({}),
    } as unknown as IssueRepository;
    const service = new IssueService(repository);

    await service.record(
      input({
        fingerprint: {
          detectorType: "guardrail",
          tools: ["search", "refundInvoice"],
          reasonCode: "APPROVAL_MISSING",
        },
      }),
    );
    await service.record(
      input({
        fingerprint: {
          detectorType: "guardrail",
          tools: ["refundInvoice", "search"],
          reasonCode: "APPROVAL_MISSING",
        },
      }),
    );

    const first = (repository.record as jest.Mock).mock.calls[0][0];
    const second = (repository.record as jest.Mock).mock.calls[1][0];
    expect(first.stableFingerprint).toBe(second.stableFingerprint);
    expect(first.exactFingerprint).toBe(second.exactFingerprint);
  });

  it("rejects a prompt version outside the authenticated workspace", async () => {
    const repository = {
      findPromptVersion: jest.fn().mockResolvedValue(null),
      record: jest.fn(),
    } as unknown as IssueRepository;
    const service = new IssueService(repository);

    await expect(
      service.record(input({ promptVersionId: "prompt-version-1" })),
    ).rejects.toThrow("PROMPT_VERSION_NOT_FOUND");
    expect(repository.findPromptVersion).toHaveBeenCalledWith(
      "workspace-1",
      "prompt-version-1",
    );
    expect(repository.record).not.toHaveBeenCalled();
  });

  it("includes the verified internal version in prompt regression fingerprints", async () => {
    const repository = {
      findPromptVersion: jest
        .fn()
        .mockImplementation(
          (_workspaceId: string, promptVersionId: string) =>
            Promise.resolve({ id: promptVersionId }),
        ),
      record: jest.fn().mockResolvedValue({}),
    } as unknown as IssueRepository;
    const service = new IssueService(repository);
    const regression = {
      category: ISSUE_CATEGORY.PROMPT_REGRESSION,
      fingerprint: {
        detectorType: "prompt-regression",
        reasonCode: "SUCCESS_RATE_DROP",
      },
    };

    await service.record(
      input({ ...regression, promptVersionId: "prompt-version-1" }),
    );
    await service.record(
      input({ ...regression, promptVersionId: "prompt-version-2" }),
    );

    const first = (repository.record as jest.Mock).mock.calls[0][0];
    const second = (repository.record as jest.Mock).mock.calls[1][0];
    expect(first.promptVersionId).toBe("prompt-version-1");
    expect(second.promptVersionId).toBe("prompt-version-2");
    expect(first.stableFingerprint).toBe(second.stableFingerprint);
    expect(first.exactFingerprint).not.toBe(second.exactFingerprint);
  });

  it("keeps a stable relationship while separating exact guardrail occurrences by prompt version", async () => {
    const repository = {
      findPromptVersion: jest
        .fn()
        .mockImplementation(
          (_workspaceId: string, promptVersionId: string) =>
            Promise.resolve({ id: promptVersionId }),
        ),
      record: jest.fn().mockResolvedValue({}),
    } as unknown as IssueRepository;
    const service = new IssueService(repository);

    await service.record(input({ promptVersionId: "prompt-version-1" }));
    await service.record(input({ promptVersionId: "prompt-version-2" }));

    const first = (repository.record as jest.Mock).mock.calls[0][0];
    const second = (repository.record as jest.Mock).mock.calls[1][0];
    expect(first.promptVersionId).toBe("prompt-version-1");
    expect(second.promptVersionId).toBe("prompt-version-2");
    expect(first.stableFingerprint).toBe(second.stableFingerprint);
    expect(first.exactFingerprint).not.toBe(second.exactFingerprint);
  });
});
