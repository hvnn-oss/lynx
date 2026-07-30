import { ISSUE_CATEGORY, type IssueCategory } from "@repo/constants";
import {
  IssueRepository,
  issueRepository,
  type PersistIssueResult,
  type RecoverIssueInput,
} from "./issue.repository.js";
import type { RecordIssueInput } from "../../../common/types/issue.js";
import {
  createExactOccurrenceFingerprint,
  createStableIssueFingerprint,
} from "../../../common/util/issue-fingerprint.js";

export class IssueService {
  constructor(private readonly repository: IssueRepository = issueRepository) {}

  async record(input: RecordIssueInput): Promise<PersistIssueResult> {
    const promptVersion = input.promptVersionId
      ? await this.repository.findPromptVersion(
          input.workspaceId,
          input.promptVersionId,
        )
      : null;
    if (input.promptVersionId && !promptVersion) {
      throw new Error("PROMPT_VERSION_NOT_FOUND");
    }
    if (
      this.requiresPromptVersionInFingerprint(input.category) &&
      !promptVersion
    ) {
      throw new Error("PROMPT_VERSION_REQUIRED");
    }

    const fingerprintInput = {
      ...input.fingerprint,
      category: input.category,
      environment: input.environment,
      agentId: input.agentId,
      promptVersionId: promptVersion?.id,
    };
    const stableFingerprint = createStableIssueFingerprint(fingerprintInput);
    const exactFingerprint = createExactOccurrenceFingerprint(
      fingerprintInput,
      stableFingerprint,
    );

    return this.repository.record({
      ...input,
      promptVersionId: promptVersion?.id,
      stableFingerprint,
      exactFingerprint,
      riskSignals: input.riskSignals ?? [],
      reproductionSteps: input.reproductionSteps ?? [],
      tags: input.tags ?? [],
    });
  }

  /** SDK가 보낸 정상화 근거로 기존 열린 이슈를 해결 처리합니다. */
  recover(input: RecoverIssueInput) {
    return this.repository.recover(input);
  }

  private requiresPromptVersionInFingerprint(category: IssueCategory): boolean {
    return category === ISSUE_CATEGORY.PROMPT_REGRESSION;
  }
}

export const issueService = new IssueService();
