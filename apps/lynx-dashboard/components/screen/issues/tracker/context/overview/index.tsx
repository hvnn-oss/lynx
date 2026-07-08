"use client";

import { IssueTrackerItemOverviewKPI } from "./kpi";
import { IssueTrackerItemRelateAgents } from "./relate-agent";
import { IssueTrackerItemRelateSessions } from "./relate-session";

export function IssueTrackerItemOverview() {
  return (
    <div className="w-full bg-background rounded-md p-5">
      <IssueTrackerItemOverviewKPI />
      <div className="p-5 flex  flex-col gap-1">
        <p className="font-bold">사건 요약</p>
        <h2 className="text-sm">
          상담 프롬프트 v.1.23.0을 사용하는 에이전트가 비정상 환불 금액으로 결제
          도구를 호출하려 했고,
          <br />
          Lynx의 방화벽이 비정상 환불 방지 규칙에 의해 실행 전에 차단했습니다.
        </h2>
      </div>
      <div className="flex flex-col mt-5">
        <IssueTrackerItemRelateAgents />
        <IssueTrackerItemRelateSessions />
      </div>
    </div>
  );
}
