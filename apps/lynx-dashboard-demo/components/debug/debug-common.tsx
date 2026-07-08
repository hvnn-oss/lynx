"use client";

import Link from "next/link";
import { ChevronDown, ExternalLink } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { DashboardPanel } from "@repo/ui/components/dashboard/panel";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "good" | "warning" | "bad";
type Severity = "INFO" | "WARNING" | "CRITICAL";

export function DebugSummaryCard({
  label,
  value,
  description,
  tone = "neutral",
}: {
  label: string;
  value: string;
  description?: string;
  tone?: Tone;
}) {
  return (
    <DashboardPanel>
      <p className="truncate text-sm font-medium text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-3 text-2xl font-semibold tabular-nums",
          toneClass(tone),
        )}
      >
        {value}
      </p>
      {description ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </DashboardPanel>
  );
}

export function IssueBadge({
  label,
  tone = "warning",
}: {
  label: string;
  tone?: Tone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium",
        badgeClass(tone),
      )}
    >
      {label}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity?: Severity }) {
  if (!severity) return null;

  return (
    <IssueBadge
      label={severity}
      tone={
        severity === "CRITICAL"
          ? "bad"
          : severity === "WARNING"
            ? "warning"
            : "neutral"
      }
    />
  );
}

export function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const normalized = status.toLowerCase();
  return (
    <IssueBadge
      label={status}
      tone={
        normalized.includes("success") ||
        normalized.includes("resolved") ||
        normalized.includes("matched")
          ? "good"
          : normalized.includes("fail") ||
              normalized.includes("timeout") ||
              normalized.includes("open")
            ? "bad"
            : normalized.includes("warning") ||
                normalized.includes("investigating") ||
                normalized.includes("retry")
              ? "warning"
              : "neutral"
      }
    />
  );
}

export function LatencyBadge({ value }: { value?: number }) {
  if (typeof value !== "number") {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <IssueBadge
      label={`${Math.round(value).toLocaleString("ko-KR")}ms`}
      tone={value >= 10000 ? "bad" : value >= 3000 ? "warning" : "neutral"}
    />
  );
}

export function CostBadge({ value }: { value?: number }) {
  if (typeof value !== "number") {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <IssueBadge
      label={`$${value.toFixed(3)}`}
      tone={value >= 1 ? "warning" : "neutral"}
    />
  );
}

export function TraceLink({
  traceId,
  href,
}: {
  traceId: string;
  href?: string;
}) {
  return (
    <Button asChild size="xs" variant="ghost">
      <Link href={href ?? `/debug/trace/${traceId}`}>
        {traceId}
        <ExternalLink className="size-3" />
      </Link>
    </Button>
  );
}

export function SessionLink({ sessionId }: { sessionId: string }) {
  return (
    <Button asChild size="xs" variant="ghost">
      <Link href={`/dashboard/session/${sessionId}`}>
        {sessionId}
        <ExternalLink className="size-3" />
      </Link>
    </Button>
  );
}

export function DebugFilterBar({
  basicFilters,
  advancedFilters,
  basicTitle = "Basic filters",
  advancedTitle = "Advanced filters",
}: {
  basicFilters: string[];
  advancedFilters: string[];
  basicTitle?: string;
  advancedTitle?: string;
}) {
  return (
    <DashboardPanel>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{basicTitle}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {basicFilters.map((filter) => (
              <FilterChip key={filter}>{filter}</FilterChip>
            ))}
          </div>
        </div>
        <details className="group min-w-0 lg:w-[420px]">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted/40">
            {advancedTitle}
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {advancedFilters.map((filter) => (
              <FilterChip key={filter}>{filter}</FilterChip>
            ))}
          </div>
        </details>
      </div>
    </DashboardPanel>
  );
}

export function DebugEmptyState({
  title,
  description,
  sdkGuideLabel = "SDK guide",
  sampleTraceLabel = "Sample trace",
  sendTestEventLabel = "Send test event",
}: {
  title: string;
  description: string;
  sdkGuideLabel?: string;
  sampleTraceLabel?: string;
  sendTestEventLabel?: string;
}) {
  return (
    <DashboardPanel>
      <div className="mx-auto flex max-w-xl flex-col items-center py-10 text-center">
        <p className="text-base font-semibold tracking-normal">{title}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="https://docs.lynxops.co">{sdkGuideLabel}</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/debug/trace/demo-session-1">{sampleTraceLabel}</Link>
          </Button>
          <Button size="sm" variant="outline" type="button">
            {sendTestEventLabel}
          </Button>
        </div>
      </div>
    </DashboardPanel>
  );
}

export function RawJsonCollapse({ value }: { value?: unknown }) {
  if (value === undefined) return null;

  return (
    <details className="rounded-md border border-border/60 bg-muted/20">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold">
        Raw JSON
      </summary>
      <pre className="max-h-72 overflow-auto border-t border-border/60 bg-background p-3 text-xs leading-5">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

export function PayloadPreview({
  title,
  value,
}: {
  title: string;
  value?: string;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-3">
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      <p className="mt-2 line-clamp-3 text-sm leading-6">{value || "-"}</p>
    </div>
  );
}

export function RelatedItemsPanel({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: string; href?: string }>;
}) {
  return (
    <DashboardPanel>
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div
            key={`${item.label}-${item.value}`}
            className="flex items-center justify-between gap-3"
          >
            <p className="text-xs text-muted-foreground">{item.label}</p>
            {item.href ? (
              <Button asChild size="xs" variant="ghost">
                <Link href={item.href}>{item.value}</Link>
              </Button>
            ) : (
              <p className="text-sm font-medium">{item.value}</p>
            )}
          </div>
        ))}
      </div>
    </DashboardPanel>
  );
}

function FilterChip({ children }: { children: string }) {
  return (
    <span className="rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function toneClass(tone: Tone) {
  if (tone === "good") return "text-emerald-700";
  if (tone === "warning") return "text-amber-700";
  if (tone === "bad") return "text-rose-700";
  return "";
}

function badgeClass(tone: Tone) {
  if (tone === "good")
    return "border border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "warning")
    return "border border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "bad") return "border border-rose-200 bg-rose-50 text-rose-700";
  return "border border-border/60 bg-muted/40 text-muted-foreground";
}
