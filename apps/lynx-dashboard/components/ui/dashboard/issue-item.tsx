"use client";
import {
  DangerLevelBedge,
  DangerLevelType,
} from "@/components/ui/dashboard/danger-level-badge";
import Link from "next/link";

export function IssueItem({
  sessionId,
  title,
  level,
}: {
  sessionId: string;
  title: string;
  level: DangerLevelType;
}) {
  return (
    <Link
      href={`/issues/tracker/${sessionId}`}
      className="flex items-center justify-between px-8 p-3 hover:bg-surface cursor-pointer"
    >
      <div>
        <p className="font-bold">{title}</p>
        <p className="text-sm font-light">
          3분 전 · 환불 상담 에이전트 · 환불 요청
        </p>
      </div>
      <div>
        <DangerLevelBedge level={level} />
      </div>
    </Link>
  );
}
