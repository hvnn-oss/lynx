import { ISSUE_STATUS, type IssueStatus } from "@repo/constants";

const allowedTransitions: Record<IssueStatus, ReadonlySet<IssueStatus>> = {
  [ISSUE_STATUS.OPEN]: new Set([
    ISSUE_STATUS.INVESTIGATING,
    ISSUE_STATUS.RESOLVED,
    ISSUE_STATUS.IGNORED,
  ]),
  [ISSUE_STATUS.INVESTIGATING]: new Set([
    ISSUE_STATUS.OPEN,
    ISSUE_STATUS.RESOLVED,
    ISSUE_STATUS.IGNORED,
  ]),
  [ISSUE_STATUS.RESOLVED]: new Set([ISSUE_STATUS.OPEN]),
  [ISSUE_STATUS.IGNORED]: new Set([ISSUE_STATUS.OPEN]),
};

/** 같은 상태 유지 또는 명시적으로 허용된 이슈 상태 전이인지 확인합니다. */
export function canTransitionIssueStatus(
  current: IssueStatus,
  next: IssueStatus,
): boolean {
  return current === next || allowedTransitions[current].has(next);
}
