"use client";

import { DashboardPanel } from "@repo/ui/components/dashboard/panel";
import {
  getDemoDebugDetail,
  type DebugDetailKind,
} from "@/services/debug-detail-fixtures";
import { cn } from "@/lib/utils";

export function DebugDetailView({
  kind,
  id,
}: {
  kind: DebugDetailKind;
  id: string;
}) {
  const detail = getDemoDebugDetail(kind, id);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-normal">{detail.title}</h1>
          {detail.severity ? (
            <SeverityBadge severity={detail.severity} />
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{detail.subtitle}</p>
      </div>

      <DashboardPanel>
        <p className="text-sm leading-6 text-muted-foreground">
          {detail.summary}
        </p>
      </DashboardPanel>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {detail.metrics.map((metric) => (
          <DashboardPanel key={metric.label}>
            <p className="text-sm font-medium text-muted-foreground">
              {metric.label}
            </p>
            <p
              className={cn(
                "mt-3 text-2xl font-semibold tabular-nums tracking-normal",
                metric.tone === "good"
                  ? "text-emerald-700"
                  : metric.tone === "warning"
                    ? "text-amber-700"
                    : metric.tone === "bad"
                      ? "text-rose-700"
                      : "",
              )}
            >
              {metric.value}
            </p>
          </DashboardPanel>
        ))}
      </div>

      {detail.sections.map((section) => (
        <section key={section.title}>
          <h2 className="mb-3 text-lg font-semibold tracking-normal">
            {section.title}
          </h2>
          <DashboardPanel>
            <dl className="divide-y divide-border/40">
              {section.rows.map((row) => (
                <div
                  key={`${row.label}-${row.value}`}
                  className="grid gap-2 py-3 md:grid-cols-[180px_1fr]"
                >
                  <dt className="text-sm font-medium text-muted-foreground">
                    {row.label}
                  </dt>
                  <dd className="min-w-0 break-words text-sm font-medium">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </DashboardPanel>
        </section>
      ))}
    </div>
  );
}

function SeverityBadge({
  severity,
}: {
  severity: "INFO" | "WARNING" | "CRITICAL";
}) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-1 text-xs font-medium",
        severity === "CRITICAL"
          ? "bg-rose-50 text-rose-700"
          : severity === "WARNING"
            ? "bg-amber-50 text-amber-700"
            : "bg-emerald-50 text-emerald-700",
      )}
    >
      {severity}
    </span>
  );
}
