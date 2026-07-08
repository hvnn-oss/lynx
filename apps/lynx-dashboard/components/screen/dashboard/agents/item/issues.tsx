"use client";
import { DangerLevelType } from "@/components/ui/dashboard/danger-level-badge";
import { IssueItem } from "@/components/ui/dashboard/issue-item";
import { Button } from "@repo/ui/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function DashboardAgentItemIssues() {
  return (
    <div className="bg-background rounded-md py-5 min-h-96 flex flex-col justify-between">
      <div>
        <div className="px-5 pb-5">
          <h2 className="font-bold">현재 열려 있는 이슈 목록</h2>
        </div>
        <div>
          <IssueItem
            title="비정상 환불 방지 규칙에 의해 동작이 차단됨"
            sessionId="e3e78869-af5f-40a2-ba2d-921daae6687f"
            level={DangerLevelType.CRITICAL}
          />
          <IssueItem
            title="비속어 방지 규칙에 의해 문제가 탐지됨"
            sessionId="d5723ab2-968b-486d-91b1-6cbddb0df7cd"
            level={DangerLevelType.WARN}
          />
          <IssueItem
            title="비속어 방지 규칙에 의해 문제가 탐지됨"
            sessionId="3039bd06-0489-45d1-9583-bc8ec22c8b16"
            level={DangerLevelType.WARN}
          />
        </div>
      </div>
      <div className="px-5 pt-5 flex justify-center gap-10">
        <Button variant={"ghost"} size={"xs"} disabled>
          <ChevronLeft />
        </Button>
        <p className="text-sm text-foreground/50">1/1</p>
        <Button variant={"ghost"} size={"xs"} disabled>
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
