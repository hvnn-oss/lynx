"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ListSkeleton } from "../shared/skeletons";
import {
  DashboardMoreRow,
  formatShortDate,
  getCappedItems,
} from "@/components/dashboard/shared/dashboard-panels";
import { useDashboardInsightsData } from "@/hooks/pages/use-dashboard-section-data";
import { cn } from "@/lib/utils";

const INSIGHT_LIMIT = 6;

export function InsightList() {
  const t = useTranslations("dashboard.insights");
  const sharedT = useTranslations("dashboard.shared");
  const query = useDashboardInsightsData(["dashboard.insights.list"]);

  if (query.isLoading || !query.data) {
    return <ListSkeleton className="w-full" rows={3} />;
  }

  if (query.data.insights.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 bg-background p-8 text-center text-sm text-muted-foreground">
        {t("empty")}
      </div>
    );
  }

  const { items, hiddenCount } = getCappedItems(
    query.data.insights,
    INSIGHT_LIMIT,
  );

  return (
    <div className="space-y-4">
      {items.map((insight) => (
        <div
          key={insight.id}
          className={cn(
            "rounded-lg border bg-background p-5",
            insight.severity === "CRITICAL"
              ? "border-rose-200"
              : "border-amber-200",
          )}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-3">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  insight.severity === "CRITICAL"
                    ? "bg-rose-50 text-rose-700"
                    : "bg-amber-50 text-amber-700",
                )}
              >
                <AlertTriangle className="size-4" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold tracking-normal">
                    {insight.type}
                  </p>
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                      insight.severity === "CRITICAL"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-amber-50 text-amber-700",
                    )}
                  >
                    {insight.severity === "CRITICAL"
                      ? t("critical")
                      : t("warning")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatShortDate(insight.timestamp)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {insight.details.summary}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/insights/${insight.id}`}>
                {t("analyze")}
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>

          <Separator className="my-4 bg-border/40" />

          <div className="grid gap-4 md:grid-cols-3">
            <InsightMeta label={t("rootCause")} value={insight.cause} />
            <InsightMeta label={t("impact")} value={insight.impact} />
            <InsightMeta
              label={t("affectedAgents")}
              value={t("affectedAgentsCount", {
                count: insight.affectedAgentsCount,
              })}
            />
          </div>
        </div>
      ))}
      <DashboardMoreRow
        hiddenCount={hiddenCount}
        label={sharedT("remainingItems", {
          count: hiddenCount,
          itemName: "인사이트",
        })}
      />
    </div>
  );
}

function InsightMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
