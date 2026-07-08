"use client";
import Link from "next/link";
import { AgentStatusBedge, AgentStatusType } from "./agent-status-badge";
import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";

export function AgentItem({
  agentId,
  title,
  status,
}: {
  agentId: string;
  title: string;
  status: AgentStatusType;
}) {
  return (
    <Link
      href={`/dashboard/agents/${agentId}`}
      className="flex items-center justify-between px-8 p-3 hover:bg-surface cursor-pointer"
    >
      <p className="font-bold">{title}</p>
      <div>
        <AgentStatusBedge status={status} />
      </div>
    </Link>
  );
}
