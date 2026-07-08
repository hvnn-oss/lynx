"use client";
import { SessionItem } from "@/components/ui/dashboard/session-item";
import { Button } from "@repo/ui/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function IssueTrackerItemRelateSessions() {
  return (
    <div>
      <div>
        <div className="px-5 pt-5 pb-3">
          <h2 className="font-bold">연관되어 있는 세션 목록</h2>
        </div>
        <div>
          <SessionItem
            title="인천 - 나리타 항공권 환불 요청"
            sessionId="3039bd06-0489-45d1-9583-bc8ec22c8b16"
          />
          <SessionItem
            title="항공권 가격 비교"
            sessionId="3039bd06-0489-45d1-9583-bc8ec22c8b16"
          />
          <SessionItem
            title="일등석과 비즈니스석의 가격 비교"
            sessionId="3039bd06-0489-45d1-9583-bc8ec22c8b16"
          />
          <SessionItem
            title="김포 - 제주도 최저가 항공권 검색"
            sessionId="3039bd06-0489-45d1-9583-bc8ec22c8b16"
          />
          <SessionItem
            title="김해 - 인천 항공권 가격 비교"
            sessionId="3039bd06-0489-45d1-9583-bc8ec22c8b16"
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
