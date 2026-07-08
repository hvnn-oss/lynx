"use client";
import { AgentItem } from "@/components/ui/dashboard/agent-item";
import { AgentStatusType } from "@/components/ui/dashboard/agent-status-badge";
import { Button } from "@repo/ui/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function IssueTrackerItemRelateAgents() {
  return (
    <div>
      <div>
        <div className="px-5 pt-5 pb-3">
          <h2 className="font-bold">연관되어 있는 에이전트 목록</h2>
        </div>
        <div>
          <AgentItem
            title="고객 상담 에이전트"
            status={AgentStatusType.ACTIVE}
            agentId="3039bd06-0489-45d1-9583-bc8ec22c8b16"
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
