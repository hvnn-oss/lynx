import type { DashboardHomeMetricsDto } from "@repo/dto";
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { AlertTriangle, ArrowRight, Clock, GitBranch } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ListSkeleton } from "../shared/skeletons";
import {
  DashboardMoreRow,
  getCappedItems,
} from "@/components/dashboard/shared/dashboard-panels";
import { cn } from "@/lib/utils";

type RecentIssue = DashboardHomeMetricsDto["recentIssues"][number];

interface RecentIssuesProps {
  data?: RecentIssue[];
  isLoading?: boolean;
}

const RECENT_ISSUE_LIMIT = 5;

export function RecentIssues({ data, isLoading = false }: RecentIssuesProps) {
  const t = useTranslations("dashboard.home.issues");
  const sharedT = useTranslations("dashboard.shared");

  if (isLoading || !data) return <ListSkeleton className="w-full" rows={4} />;

  const { items, hiddenCount } = getCappedItems(data, RECENT_ISSUE_LIMIT);

  return (
    <div className="rounded-lg border border-border/60 bg-background p-4">
      {data.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <div className="space-y-1">
          {items.map((issue, index) => (
            <div key={issue.id}>
              <div className="grid gap-3 py-3 md:grid-cols-[1fr_auto] md:items-center">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md",
                      issue.severity === "CRITICAL"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-amber-50 text-amber-700",
                    )}
                  >
                    <AlertTriangle className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {issue.issueType}
                      </p>
                      <SeverityBadge severity={issue.severity} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{issue.agentName}</span>
                      <span className="inline-flex items-center gap-1">
                        <GitBranch className="size-3" />
                        {t("affectedSessions", {
                          count: issue.affectedSessionsCount ?? 1,
                        })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {t("lastSeen", {
                          time: formatRelativeTime(
                            issue.lastSeenAt ?? issue.timestamp,
                            t,
                          ),
                        })}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 md:justify-end">
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {t("occurrences", { count: issue.occurrenceCount ?? 1 })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("occurrenceLabel")}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="xs">
                    <Link href={`/dashboard/issues/${issue.id}`}>
                      {t("analyze")}
                      <ArrowRight className="size-3" />
                    </Link>
                  </Button>
                </div>
              </div>
              {index < items.length - 1 ? <Separator /> : null}
            </div>
          ))}
          <DashboardMoreRow
            hiddenCount={hiddenCount}
            label={sharedT("remainingItems", {
              count: hiddenCount,
              itemName: "이슈",
            })}
          />
        </div>
      )}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: RecentIssue["severity"] }) {
  const t = useTranslations("dashboard.home.issues");

  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        severity === "CRITICAL"
          ? "bg-rose-50 text-rose-700"
          : "bg-amber-50 text-amber-700",
      )}
    >
      {severity === "CRITICAL" ? t("critical") : t("warning")}
    </span>
  );
}

function formatRelativeTime(
  value: string,
  t: ReturnType<typeof useTranslations<"dashboard.home.issues">>,
) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const diffMinutes = Math.max(
    0,
    Math.round((Date.now() - date.getTime()) / 60000),
  );
  if (diffMinutes < 1) return t("justNow");
  if (diffMinutes < 60) return t("minutesAgo", { count: diffMinutes });

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return t("hoursAgo", { count: diffHours });

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
