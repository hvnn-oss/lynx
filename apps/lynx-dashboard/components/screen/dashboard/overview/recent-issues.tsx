import { cn } from "@/lib/utils";
import type { DashboardOverviewResponseDto } from "@repo/dto";
import {
  DashboardListPanel,
  DashboardListRow,
  DashboardRowSeparator,
  DashboardSectionHeader,
} from "@repo/ui/components/dashboard/panel";
import { buttonVariants } from "@repo/ui/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

export function RecentIssues({
  issues,
}: {
  issues: DashboardOverviewResponseDto["importantIssues"];
}) {
  const t = useTranslations("dashboard.overview.recentIssues");

  return (
    <section className="space-y-3">
      <DashboardSectionHeader
        title={t("title")}
        description={t("description")}
        action={
          <Link
            href="/issues/overview"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            {t("action")}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        }
      />
      <DashboardListPanel empty={issues.length === 0} emptyText={t("empty")}>
        {issues.map((issue, index) => (
          <div key={issue.id}>
            {index > 0 ? <DashboardRowSeparator /> : null}
            <Link href={`/issues/tracker/${issue.id}`} className="block">
              <DashboardListRow
                title={issue.title}
                description={t(`severity.${issue.severity}`)}
                value={t("row.action")}
                tone={
                  issue.severity === "CRITICAL"
                    ? "bad"
                    : issue.severity === "WARNING"
                      ? "warning"
                      : "neutral"
                }
                markerClassName={
                  issue.severity === "CRITICAL"
                    ? "bg-rose-500"
                    : issue.severity === "WARNING"
                      ? "bg-amber-500"
                      : "bg-muted-foreground/40"
                }
              />
            </Link>
          </div>
        ))}
      </DashboardListPanel>
    </section>
  );
}
