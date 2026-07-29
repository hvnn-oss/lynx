"use client";

import type { DashboardSessionDetailResponseDto } from "@repo/dto";
import {
  DashboardListPanel,
  DashboardListRow,
  DashboardMetricCard,
  DashboardMetricGrid,
  DashboardPanel,
  DashboardPageHeader,
  DashboardSectionHeader,
} from "@repo/ui/components/dashboard/panel";
import { Button } from "@repo/ui/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ShieldAlert,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  ActualDataPageLoading,
  ActualDataPageMessage,
  formatDuration,
} from "@/components/screen/dashboard/actual-data-page";
import {
  useDashboardAgentDetail,
  useDashboardSessionDetail,
} from "@/hooks/use-dashboard-operational-pages";

export function DashboardSessionDetailScreen({ id }: { id: string }) {
  const t = useTranslations("detailPages.session");
  const format = useFormatter();
  const { data, isPending, isError, refetch } = useDashboardSessionDetail(id);

  if (isPending) return <ActualDataPageLoading />;
  if (isError || !data)
    return (
      <ActualDataPageMessage
        title={t("error.title")}
        description={t("error.description")}
        pageTitle={t("title")}
        pageDescription={t("description")}
        action={t("error.action")}
        onRetry={() => void refetch()}
      />
    );

  return (
    <div className="space-y-8 p-20">
      <DashboardPageHeader
        title={data.sessionId}
        description={t("header", {
          agent: data.agent.name,
          startedAt: format.dateTime(new Date(data.startedAt), {
            dateStyle: "medium",
            timeStyle: "short",
          }),
          lastActivityAt: format.dateTime(new Date(data.lastActivityAt), {
            dateStyle: "medium",
            timeStyle: "short",
          }),
        })}
      />
      <DashboardMetricGrid>
        <DashboardMetricCard label={t("metrics.status")} value={data.status} />
        <DashboardMetricCard
          label={t("metrics.duration")}
          value={formatDuration(data.durationMs)}
          description={t("metrics.elapsedDuration", {
            duration: formatDuration(data.elapsedDurationMs),
          })}
        />
        <DashboardMetricCard
          label={t("metrics.runs")}
          value={String(data.runCount)}
        />
        <DashboardMetricCard
          label={t("metrics.tokens")}
          value={format.number(data.totalTokens)}
        />
        <DashboardMetricCard
          label={t("metrics.cost")}
          value={format.number(data.cost, {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 4,
          })}
          description={t("metrics.issues", { count: data.issueCount })}
          tone={data.issueCount > 0 ? "warning" : "neutral"}
        />
      </DashboardMetricGrid>
      <section className="space-y-3">
        <DashboardSectionHeader
          title={t("events.title")}
          description={t("events.subtitle", { count: data.events.length })}
        />
        <DashboardPanel className="border border-border/60 p-0">
          {data.events.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {t("events.empty")}
            </p>
          ) : (
            <ol className="relative divide-y divide-border/40">
              <span
                aria-hidden
                className="absolute bottom-8 left-[1.3rem] top-8 w-px bg-border"
              />
              {data.events.map((event, index) => (
                <SessionEventTimelineItem
                  key={event.id}
                  event={event}
                  isInitiallyOpen={index === 0}
                />
              ))}
            </ol>
          )}
          {data.events.length > 0 ? (
            <div className="space-y-2 border-t border-border/40 px-4 py-3">
              {data.hasMoreEvents ? (
                <p className="text-center text-xs text-muted-foreground">
                  {t("events.more")}
                </p>
              ) : null}
              <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                <span>{t("events.securityNote")}</span>
              </p>
            </div>
          ) : null}
        </DashboardPanel>
      </section>
    </div>
  );
}

export function DashboardAgentDetailScreen({ id }: { id: string }) {
  const t = useTranslations("detailPages.agent");
  const format = useFormatter();
  const { data, isPending, isError, refetch } = useDashboardAgentDetail(id);

  if (isPending) return <ActualDataPageLoading />;
  if (isError || !data)
    return (
      <ActualDataPageMessage
        title={t("error.title")}
        description={t("error.description")}
        pageTitle={t("title")}
        pageDescription={t("description")}
        action={t("error.action")}
        onRetry={() => void refetch()}
      />
    );

  return (
    <div className="space-y-8 p-20">
      <DashboardPageHeader
        title={data.name}
        description={data.description ?? t("noDescription")}
      />
      <DashboardMetricGrid>
        <DashboardMetricCard
          label={t("metrics.runs")}
          value={String(data.metrics.runCount)}
        />
        <DashboardMetricCard
          label={t("metrics.completed")}
          value={String(data.metrics.completedRunCount)}
          tone="good"
        />
        <DashboardMetricCard
          label={t("metrics.failed")}
          value={String(data.metrics.failedRunCount)}
          tone={data.metrics.failedRunCount > 0 ? "bad" : "neutral"}
        />
        <DashboardMetricCard
          label={t("metrics.tokens")}
          value={format.number(data.metrics.totalTokens)}
        />
        <DashboardMetricCard
          label={t("metrics.cost")}
          value={format.number(data.metrics.totalCost, {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 4,
          })}
          description={data.defaultModel}
        />
      </DashboardMetricGrid>
      <section className="grid gap-8 xl:grid-cols-2">
        <DashboardListPanel
          empty={data.recentRuns.length === 0}
          emptyText={t("runs.empty")}
        >
          <h2 className="px-2 pb-2 text-sm font-semibold">{t("runs.title")}</h2>
          {data.recentRuns.map((run) => (
            <DashboardListRow
              key={run.id}
              title={run.runId}
              description={format.dateTime(new Date(run.startedAt), {
                dateStyle: "short",
                timeStyle: "short",
              })}
              value={run.status}
              tone={run.status === "FAILED" ? "bad" : "neutral"}
            />
          ))}
        </DashboardListPanel>
        <DashboardListPanel
          empty={data.recentIssues.length === 0}
          emptyText={t("issues.empty")}
        >
          <h2 className="px-2 pb-2 text-sm font-semibold">
            {t("issues.title")}
          </h2>
          {data.recentIssues.map((issue) => (
            <DashboardListRow
              key={issue.id}
              title={issue.title}
              description={format.dateTime(new Date(issue.lastSeenAt), {
                dateStyle: "short",
                timeStyle: "short",
              })}
              value={issue.severity}
              tone={issue.severity === "CRITICAL" ? "bad" : "warning"}
            />
          ))}
        </DashboardListPanel>
      </section>
    </div>
  );
}

type SessionEvent = DashboardSessionDetailResponseDto["events"][number];

interface EventPayloadSection {
  key: string;
  labelKey: "input" | "output" | "arguments" | "error" | "usage" | "metadata";
  value: unknown;
  tone?: "default" | "error";
}

function SessionEventTimelineItem({
  event,
  isInitiallyOpen,
}: {
  event: SessionEvent;
  isInitiallyOpen: boolean;
}) {
  const t = useTranslations("detailPages.session.events");
  const format = useFormatter();
  const [isOpen, setIsOpen] = useState(isInitiallyOpen);
  const [isCopied, setIsCopied] = useState(false);
  const tone = getEventTone(event.eventType);
  const payloadSections = getPayloadSections(event.payload);
  const rawJson = stringifyValue(event);

  useEffect(() => {
    if (!isCopied) return;

    const timeoutId = window.setTimeout(() => setIsCopied(false), 2_000);
    return () => window.clearTimeout(timeoutId);
  }, [isCopied]);

  const copyRawJson = async () => {
    try {
      await navigator.clipboard.writeText(rawJson);
      setIsCopied(true);
    } catch {
      setIsCopied(false);
    }
  };

  return (
    <li className="relative pl-11">
      <span
        aria-hidden
        className={`absolute left-[1.05rem] top-[1.45rem] size-2.5 rounded-full ring-4 ring-background ${tone.marker}`}
      />
      <button
        type="button"
        aria-expanded={isOpen}
        className="flex w-full items-start justify-between gap-4 px-0 py-4 pr-4 text-left transition-colors hover:bg-muted/20"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{event.label}</span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${tone.badge}`}
            >
              {event.eventType}
            </span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              {format.dateTime(new Date(event.timestamp), {
                dateStyle: "medium",
                timeStyle: "medium",
              })}
            </span>
            {event.latency !== null ? (
              <span>
                {t("latency")}: {formatDuration(event.latency)}
              </span>
            ) : null}
            {event.cost !== null ? (
              <span>
                {t("cost")}:{" "}
                {format.number(event.cost, {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 6,
                })}
              </span>
            ) : null}
          </span>
        </span>
        {isOpen ? (
          <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {isOpen ? (
        <div className="pb-5 pr-4">
          <Tabs defaultValue="summary" className="gap-4">
            <TabsList variant="line">
              <TabsTrigger value="summary" className="px-3">
                {t("summaryTab")}
              </TabsTrigger>
              <TabsTrigger value="raw" className="px-3">
                {t("rawTab")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="summary">
              <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {t("eventId")}: {event.eventId ?? event.id}
                </span>
              </div>
              {payloadSections.length === 0 ? (
                <p className="rounded-md bg-muted/30 px-3 py-8 text-center text-sm text-muted-foreground">
                  {t("notCollected")}
                </p>
              ) : (
                <div className="grid gap-x-6 gap-y-5 lg:grid-cols-2">
                  {payloadSections.map((section) => (
                    <EventValueBlock
                      key={section.key}
                      label={t(section.labelKey)}
                      value={section.value}
                      tone={section.tone}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="raw">
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="absolute right-2 top-2 z-10"
                  onClick={() => void copyRawJson()}
                >
                  {isCopied ? <Check /> : <Copy />}
                  {isCopied ? t("copied") : t("copy")}
                </Button>
                <pre className="max-h-[32rem] overflow-auto rounded-md bg-muted/50 p-4 pr-28 text-xs leading-5 text-foreground">
                  <code>{rawJson}</code>
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </li>
  );
}

function EventValueBlock({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: unknown;
  tone?: "default" | "error";
}) {
  return (
    <section className="min-w-0">
      <h3
        className={
          tone === "error"
            ? "text-xs font-semibold text-rose-700"
            : "text-xs font-semibold text-muted-foreground"
        }
      >
        {label}
      </h3>
      <pre
        className={
          tone === "error"
            ? "mt-2 max-h-72 overflow-auto rounded-md bg-rose-50 p-3 text-xs leading-5 text-rose-950 dark:bg-rose-950/20 dark:text-rose-100"
            : "mt-2 max-h-72 overflow-auto rounded-md bg-muted/40 p-3 text-xs leading-5 text-foreground"
        }
      >
        <code>{stringifyValue(value)}</code>
      </pre>
    </section>
  );
}

const INPUT_PAYLOAD_KEYS = ["input", "request", "prompt", "messages"] as const;
const OUTPUT_PAYLOAD_KEYS = ["output", "response", "result"] as const;
const ARGUMENT_PAYLOAD_KEYS = [
  "arguments",
  "args",
  "toolArguments",
  "toolInput",
] as const;
const ERROR_PAYLOAD_KEYS = ["error", "exception"] as const;
const USAGE_PAYLOAD_KEYS = ["usage", "tokenUsage", "tokens"] as const;
const SUMMARY_PAYLOAD_KEYS = new Set<string>([
  ...INPUT_PAYLOAD_KEYS,
  ...OUTPUT_PAYLOAD_KEYS,
  ...ARGUMENT_PAYLOAD_KEYS,
  ...ERROR_PAYLOAD_KEYS,
  ...USAGE_PAYLOAD_KEYS,
]);

function getPayloadSections(
  payload: Record<string, unknown>,
): EventPayloadSection[] {
  const sections: EventPayloadSection[] = [];
  const input = findFirstPayloadValue(payload, INPUT_PAYLOAD_KEYS);
  const output = findFirstPayloadValue(payload, OUTPUT_PAYLOAD_KEYS);
  const argumentsValue = findFirstPayloadValue(payload, ARGUMENT_PAYLOAD_KEYS);
  const error = findFirstPayloadValue(payload, ERROR_PAYLOAD_KEYS);
  const usage = findFirstPayloadValue(payload, USAGE_PAYLOAD_KEYS);

  if (input !== undefined)
    sections.push({ key: "input", labelKey: "input", value: input });
  if (output !== undefined)
    sections.push({ key: "output", labelKey: "output", value: output });
  if (argumentsValue !== undefined)
    sections.push({
      key: "arguments",
      labelKey: "arguments",
      value: argumentsValue,
    });
  if (error !== undefined)
    sections.push({
      key: "error",
      labelKey: "error",
      value: error,
      tone: "error",
    });
  if (usage !== undefined)
    sections.push({ key: "usage", labelKey: "usage", value: usage });

  const metadata = Object.fromEntries(
    Object.entries(payload).filter(([key]) => !SUMMARY_PAYLOAD_KEYS.has(key)),
  );
  if (Object.keys(metadata).length > 0) {
    sections.push({
      key: "metadata",
      labelKey: "metadata",
      value: metadata,
    });
  }

  return sections;
}

function findFirstPayloadValue(
  payload: Record<string, unknown>,
  keys: readonly string[],
): unknown {
  for (const key of keys) {
    if (payload[key] !== undefined) return payload[key];
  }
  return undefined;
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function getEventTone(eventType: string) {
  const normalizedType = eventType.toUpperCase();

  if (
    normalizedType.includes("ERROR") ||
    normalizedType.includes("FAIL") ||
    normalizedType.includes("VIOLATION") ||
    normalizedType.includes("BLOCK")
  ) {
    return {
      marker: "bg-rose-500",
      badge: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300",
    };
  }

  if (
    normalizedType.includes("FIREWALL") ||
    normalizedType.includes("POLICY") ||
    normalizedType.includes("APPROVAL")
  ) {
    return {
      marker: "bg-amber-500",
      badge:
        "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
    };
  }

  if (
    normalizedType.includes("LLM") ||
    normalizedType.includes("TOOL") ||
    normalizedType.includes("AGENT")
  ) {
    return {
      marker: "bg-sky-500",
      badge: "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300",
    };
  }

  return {
    marker: "bg-muted-foreground",
    badge: "bg-muted text-muted-foreground",
  };
}
