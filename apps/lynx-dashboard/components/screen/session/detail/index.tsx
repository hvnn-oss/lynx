"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Bot,
  CheckCircle2,
  CircleDot,
  Copy,
  Database,
  MessageSquare,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { DashboardPanel } from "@repo/ui/components/dashboard/panel";
import { Button } from "@repo/ui/components/ui/button";
import { OperationsKpiCard } from "@/components/ui/operations/kpi-card";
import { OperationsBadge, getStateClass } from "@/components/ui/operations/status-badge";

type SessionEventStatus = "success" | "warning" | "error" | "blocked";
type SessionEventType =
  | "user_input"
  | "context_load"
  | "llm_call"
  | "tool_call"
  | "guardrail_check"
  | "final_response";

interface SessionEvent {
  id: string;
  type: SessionEventType;
  status: SessionEventStatus;
  title: string;
  timestamp: string;
  durationMs?: number;
  tokens?: number;
  cost?: number;
  model?: string;
  tool?: string;
  summary: string;
  input?: string;
  output?: string;
  error?: string;
  raw: Record<string, unknown>;
}

type DetailTab = "summary" | "raw";

const session = {
  id: "ses_9W2K1M",
  runId: "run_refund_2048",
  traceId: "trace_refund_approval",
  agentName: "환불 상담 agent",
  environment: "production",
  status: "blocked",
  durationMs: 18420,
  tokens: 4218,
  cost: 0.086,
  issueCount: 2,
  rootCause: "승인 span 없이 고액 환불 도구 호출이 발생했습니다.",
};

const events: SessionEvent[] = [
  {
    id: "evt-input",
    type: "user_input",
    status: "success",
    title: "사용자 요청 수신",
    timestamp: "2026-07-08T09:17:18+09:00",
    durationMs: 42,
    summary: "고객이 항공권 환불 가능 여부와 즉시 처리 가능성을 문의했습니다.",
    input: "항공권 환불 요청입니다. 가능한 빨리 전체 금액을 환불해 주세요.",
    raw: {
      eventType: "user_input",
      sessionId: "ses_9W2K1M",
      inputMode: "chat",
      payloadBytes: 188,
    },
  },
  {
    id: "evt-context",
    type: "context_load",
    status: "success",
    title: "고객/주문 컨텍스트 로드",
    timestamp: "2026-07-08T09:17:19+09:00",
    durationMs: 860,
    tokens: 1320,
    summary: "고객 등급, 주문 금액, 환불 정책, 이전 상담 내역을 불러왔습니다.",
    input: "customerId=cus_2048, orderId=ord_7781",
    output: "VIP 고객, 결제 금액 12,800 USD, 부분 환불 이력 없음",
    raw: {
      eventType: "context_load",
      sources: ["crm", "billing", "policy"],
      cacheHit: false,
      tokenCount: 1320,
    },
  },
  {
    id: "evt-llm-plan",
    type: "llm_call",
    status: "warning",
    title: "환불 처리 계획 생성",
    timestamp: "2026-07-08T09:17:21+09:00",
    durationMs: 1420,
    tokens: 2140,
    cost: 0.051,
    model: "gpt-5",
    summary: "모델이 승인 대기 없이 즉시 환불 처리를 제안했습니다.",
    input: "환불 정책, 고객 등급, 주문 금액, 현재 프롬프트 refund-v18",
    output: "고객 요청을 빠르게 해결하기 위해 환불을 즉시 처리합니다.",
    raw: {
      eventType: "llm_call",
      model: "gpt-5",
      promptVersion: "refund-v18",
      inputTokens: 1640,
      outputTokens: 500,
      temperature: 0.2,
    },
  },
  {
    id: "evt-policy",
    type: "guardrail_check",
    status: "blocked",
    title: "고액 환불 승인 정책 평가",
    timestamp: "2026-07-08T09:17:24+09:00",
    durationMs: 120,
    summary: "approval span이 없는 고액 환불 요청으로 판단되어 FAIL_CLOSED를 반환했습니다.",
    input: "tool=refundInvoice, amount=12800, approvalSpan=false",
    output: "FAIL_CLOSED",
    raw: {
      eventType: "guardrail_check",
      policyId: "pol-refund-approval",
      result: "FAIL_CLOSED",
      matchedCondition: "refundInvoice amount > 5000 && approvalSpan missing",
    },
  },
  {
    id: "evt-tool",
    type: "tool_call",
    status: "blocked",
    title: "refundInvoice 호출 차단",
    timestamp: "2026-07-08T09:17:25+09:00",
    durationMs: 0,
    tool: "refundInvoice",
    summary: "도구 실행 직전에 방화벽이 호출을 차단했습니다.",
    input: '{ "invoiceId": "inv_2048", "amount": 12800 }',
    output: "blocked",
    error: "Tool call blocked by policy pol-refund-approval",
    raw: {
      eventType: "tool_call",
      toolName: "refundInvoice",
      arguments: { invoiceId: "inv_2048", amount: 12800 },
      blocked: true,
      policyId: "pol-refund-approval",
    },
  },
  {
    id: "evt-final",
    type: "final_response",
    status: "error",
    title: "세션 종료",
    timestamp: "2026-07-08T09:17:26+09:00",
    durationMs: 60,
    summary: "환불 도구 호출이 차단되어 최종 응답은 실패 상태로 종료되었습니다.",
    output: "환불 처리에 추가 승인이 필요합니다.",
    raw: {
      eventType: "final_response",
      status: "FAILED",
      reason: "blocked_tool_call",
    },
  },
];

export function SessionDetailScreen() {
  const t = useTranslations("session");
  const defaultEvent = useMemo(
    () => events.find((event) => event.status === "blocked") ?? events[0],
    [],
  );
  const [selectedEventId, setSelectedEventId] = useState(defaultEvent.id);
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");
  const selectedEvent =
    events.find((event) => event.id === selectedEventId) ?? defaultEvent;

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-5">
        <OperationsKpiCard label={t("summary.status")} value={t(`status.${session.status}`)} description={session.environment} tone="bad" />
        <OperationsKpiCard label={t("summary.duration")} value={formatMs(session.durationMs)} description={session.runId} />
        <OperationsKpiCard label={t("summary.tokens")} value={formatNumber(session.tokens)} description={t("summary.totalTokens")} />
        <OperationsKpiCard label={t("summary.cost")} value={formatCost(session.cost)} description={t("summary.estimatedCost")} tone="warning" />
        <OperationsKpiCard label={t("summary.issues")} value={String(session.issueCount)} description={t("summary.linkedIssues")} tone="warning" />
      </section>

      <DashboardPanel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <OperationsBadge className={getStateClass("blocked")}>{t("status.blocked")}</OperationsBadge>
              <OperationsBadge className="border-amber-200 bg-amber-50 text-amber-700">refund-v18</OperationsBadge>
            </div>
            <h2 className="mt-3 text-lg font-bold">{session.id}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {session.agentName} / {session.traceId}
            </p>
            <p className="mt-3 text-sm font-bold">{session.rootCause}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">{t("actions.openTrace")}</Button>
            <Button variant="outline">{t("actions.reproduce")}</Button>
          </div>
        </div>
      </DashboardPanel>

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_440px]">
        <SessionTimeline
          selectedEventId={selectedEvent.id}
          onSelect={(eventId) => {
            setSelectedEventId(eventId);
            setDetailTab("summary");
          }}
        />
        <SessionEventDetail
          event={selectedEvent}
          tab={detailTab}
          onChangeTab={setDetailTab}
        />
      </section>
    </div>
  );
}

function SessionTimeline({
  selectedEventId,
  onSelect,
}: {
  selectedEventId: string;
  onSelect: (eventId: string) => void;
}) {
  const t = useTranslations("session");

  return (
    <DashboardPanel>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">{t("detail.timeline")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("detail.timelineHint")}</p>
        </div>
        <OperationsBadge className="border-slate-200 bg-slate-50 text-slate-700">
          {events.length}
        </OperationsBadge>
      </div>
      <div className="mt-5">
        <div className="relative">
          <div className="absolute bottom-4 left-[19px] top-4 w-px bg-border" />
          <div className="space-y-2">
            {events.map((event, index) => (
              <TimelineRow
                event={event}
                index={index}
                isSelected={event.id === selectedEventId}
                key={event.id}
                onClick={() => onSelect(event.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </DashboardPanel>
  );
}

function TimelineRow({
  event,
  index,
  isSelected,
  onClick,
}: {
  event: SessionEvent;
  index: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("session");

  return (
    <button
      className={`relative grid w-full grid-cols-[40px_1fr] gap-3 rounded-lg border px-3 py-3 text-left transition hover:bg-muted/30 ${
        isSelected ? "border-primary bg-muted/30" : "border-transparent"
      }`}
      type="button"
      onClick={onClick}
    >
      <span className="relative z-10 flex size-10 items-center justify-center rounded-full bg-background">
        <span className={`flex size-8 items-center justify-center rounded-full ${getEventToneClass(event.status)}`}>
          <EventIcon type={event.type} />
        </span>
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-xs font-bold tabular-nums text-muted-foreground">#{index + 1}</span>
            <p className="truncate text-sm font-bold">{event.title}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{t(`eventTypes.${event.type}`)}</span>
            <span>{formatMs(event.durationMs)}</span>
            <span>{formatTime(event.timestamp)}</span>
          </div>
        </div>
        <p className="mt-1 truncate text-xs leading-5 text-muted-foreground">{event.summary}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <OperationsBadge className={getStatusClass(event.status)}>
            {t(`eventStatus.${event.status}`)}
          </OperationsBadge>
          {event.model ? <SmallPill>{event.model}</SmallPill> : null}
          {event.tool ? <SmallPill>{event.tool}</SmallPill> : null}
          {event.tokens ? <SmallPill>{formatNumber(event.tokens)} tokens</SmallPill> : null}
          {event.cost ? <SmallPill>{formatCost(event.cost)}</SmallPill> : null}
        </div>
      </div>
    </button>
  );
}

function SessionEventDetail({
  event,
  tab,
  onChangeTab,
}: {
  event: SessionEvent;
  tab: DetailTab;
  onChangeTab: (tab: DetailTab) => void;
}) {
  const t = useTranslations("session");

  return (
    <DashboardPanel className="2xl:sticky 2xl:top-20 2xl:self-start">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-base font-bold">{event.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {event.id} / {formatDateTime(event.timestamp)}
          </p>
        </div>
        <OperationsBadge className={getStatusClass(event.status)}>
          {t(`eventStatus.${event.status}`)}
        </OperationsBadge>
      </div>

      <div className="mt-4 inline-flex rounded-lg border border-border/70 bg-background p-1">
        {(["summary", "raw"] as const).map((item) => (
          <button
            className={`rounded-md px-3 py-1.5 text-sm font-bold transition ${
              tab === item ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            key={item}
            type="button"
            onClick={() => onChangeTab(item)}
          >
            {t(`detailTabs.${item}`)}
          </button>
        ))}
      </div>

      {tab === "summary" ? <EventSummary event={event} /> : <RawDataView event={event} />}
    </DashboardPanel>
  );
}

function EventSummary({ event }: { event: SessionEvent }) {
  const t = useTranslations("session");

  return (
    <div className="mt-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailMetric label={t("detail.duration")} value={formatMs(event.durationMs)} />
        <DetailMetric label={t("detail.tokens")} value={formatNumber(event.tokens)} />
        <DetailMetric label={t("detail.cost")} value={formatCost(event.cost)} />
        <DetailMetric label={t("detail.modelOrTool")} value={event.model ?? event.tool ?? "-"} />
      </div>
      <PreviewBlock label={t("detail.summary")} value={event.summary} />
      <PreviewBlock label={t("detail.input")} value={event.input} />
      <PreviewBlock label={t("detail.output")} value={event.output} />
      <PreviewBlock label={t("detail.error")} value={event.error} tone="bad" />
    </div>
  );
}

function RawDataView({ event }: { event: SessionEvent }) {
  const t = useTranslations("session");
  const raw = {
    id: event.id,
    type: event.type,
    status: event.status,
    timestamp: event.timestamp,
    durationMs: event.durationMs,
    tokens: event.tokens,
    cost: event.cost,
    model: event.model,
    tool: event.tool,
    input: event.input,
    output: event.output,
    error: event.error,
    raw: event.raw,
  };

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-bold">{t("detail.rawData")}</p>
        <Button size="sm" type="button" variant="outline" onClick={() => copyRaw(raw)}>
          <Copy data-icon="inline-start" />
          {t("actions.copy")}
        </Button>
      </div>
      <pre className="max-h-[520px] overflow-auto rounded-md border border-border/70 bg-muted/20 p-3 text-xs leading-5">
        {JSON.stringify(raw, null, 2)}
      </pre>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/20 p-3">
      <p className="text-xs font-bold uppercase tracking-normal text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-bold">{value}</p>
    </div>
  );
}

function PreviewBlock({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value?: string;
  tone?: "neutral" | "bad";
}) {
  if (!value) return null;

  return (
    <div className={tone === "bad" ? "rounded-md border border-rose-200 bg-rose-50 p-3" : "rounded-md border border-border/70 bg-muted/20 p-3"}>
      <p className={tone === "bad" ? "text-xs font-bold text-rose-700" : "text-xs font-bold text-muted-foreground"}>{label}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{value}</p>
    </div>
  );
}

function SmallPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function EventIcon({ type }: { type: SessionEventType }) {
  if (type === "user_input") return <MessageSquare className="size-4" />;
  if (type === "context_load") return <Database className="size-4" />;
  if (type === "llm_call") return <Bot className="size-4" />;
  if (type === "tool_call") return <Wrench className="size-4" />;
  if (type === "guardrail_check") return <ShieldAlert className="size-4" />;
  if (type === "final_response") return <CheckCircle2 className="size-4" />;
  return <CircleDot className="size-4" />;
}

function getEventToneClass(status: SessionEventStatus) {
  if (status === "error") return "bg-rose-50 text-rose-700";
  if (status === "blocked" || status === "warning") return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

function getStatusClass(status: SessionEventStatus) {
  if (status === "error") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "blocked") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "warning") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function formatNumber(value?: number) {
  if (typeof value !== "number") return "-";
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatCost(value?: number) {
  if (typeof value !== "number") return "-";
  return `$${value.toFixed(3)}`;
}

function formatMs(value?: number) {
  if (typeof value !== "number") return "-";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function copyRaw(value: unknown) {
  if (typeof navigator === "undefined") return;
  void navigator.clipboard?.writeText(JSON.stringify(value, null, 2));
}
