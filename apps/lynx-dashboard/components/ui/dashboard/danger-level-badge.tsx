"use client";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export enum DangerLevelType {
  CRITICAL = "CRITICAL",
  WARN = "WARN",
  NORMAL = "NORMAL",
}

export function DangerLevelBedge({ level }: { level: DangerLevelType }) {
  const className = {
    CRITICAL: "border-destructive text-destructive",
    WARN: "border-yellow-500 text-yellow-500",
    NORMAL: "border-foreground/50 text-foreground/50",
  };
  const t = useTranslations("dashboard.ui.danger_level");
  return (
    <div
      className={cn(
        "border w-fit text-xs py-1 px-3 rounded-md",
        className[level],
      )}
    >
      {t(level)}
    </div>
  );
}
