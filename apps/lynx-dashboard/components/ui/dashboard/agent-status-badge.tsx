"use client";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export enum AgentStatusType {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  DEAD = "DEAD",
}

export function AgentStatusBedge({ status }: { status: AgentStatusType }) {
  const className = {
    ACTIVE: "border-green-500 text-green-500",
    INACTIVE: "border-foreground/50 text-foreground/80",
    DEAD: "border-destructive text-destructive",
  };
  const t = useTranslations("dashboard.ui.agent_status");
  return (
    <div
      className={cn(
        "border w-fit text-xs py-1 px-3 rounded-md",
        className[status],
      )}
    >
      {t(status)}
    </div>
  );
}
