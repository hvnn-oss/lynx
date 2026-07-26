import type { DashboardOverviewResponseDto } from "@repo/dto";
import { DashboardPanel } from "@repo/ui/components/dashboard/panel";
import { buttonVariants } from "@repo/ui/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

export function IncidentInsight({
  issues,
}: {
  issues: DashboardOverviewResponseDto["importantIssues"];
}) {
  const t = useTranslations("dashboard.overview.incident");
  const issue = issues[0];

  if (!issue) return null;

  return (
    <DashboardPanel className="border-amber-200 bg-amber-50/40">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-amber-200 bg-background text-amber-700">
            <ShieldAlert className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              {t("eyebrow")}
            </p>
            <h2 className="mt-1 text-base font-semibold">{issue.title}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("description", { count: issues.length })}
            </p>
          </div>
        </div>
        <Link
          href={`/issues/tracker/${issue.id}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "shrink-0 bg-background",
          )}
        >
          {t("action")}
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </DashboardPanel>
  );
}
