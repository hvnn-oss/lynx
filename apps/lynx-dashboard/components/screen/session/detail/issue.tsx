"use client";
import { DangerLevelType } from "@/components/ui/dashboard/danger-level-badge";
import { IssueItem } from "@/components/ui/dashboard/issue-item";

export function SessionDetailIssues() {
  return (
    <div className="mt-2 bg-background rounded-md py-5">
      <div className="px-5 pb-5">
        <h3 className="font-bold">연관된 이슈</h3>
      </div>
      <div>
        <IssueItem
          title="비정상 환불 방지 규칙에 의해 동작이 차단됨"
          sessionId="f3ad1fa0-4144-4b8f-b1a7-4b3138fb5c75"
          level={DangerLevelType.CRITICAL}
        />
        <IssueItem
          title="비정상 환불 방지 규칙에 의해 동작이 차단됨"
          sessionId="f3ad1fa0-4144-4b8f-b1a7-4b3138fb5c75"
          level={DangerLevelType.CRITICAL}
        />
        <IssueItem
          title="비정상 환불 방지 규칙에 의해 동작이 차단됨"
          sessionId="f3ad1fa0-4144-4b8f-b1a7-4b3138fb5c75"
          level={DangerLevelType.CRITICAL}
        />
      </div>
    </div>
  );
}
