import {
  DashboardChartPanel,
  DashboardListPanel,
  DashboardListRow,
  DashboardPageHeader,
  DashboardPanel,
} from "@repo/ui/components/dashboard/panel";
import { useTranslations } from "next-intl";
import { OperationsKpiCard } from "@/components/ui/operations/kpi-card";
import { OperationsBadge, getStateClass } from "@/components/ui/operations/status-badge";

type DashboardPageKind =
  | "status"
  | "cost"
  | "sessionsOverview"
  | "sessionsCompleted"
  | "sessionsFailed"
  | "agentsOverview"
  | "agentsActive"
  | "agentsInactive";

const pageData: Record<
  DashboardPageKind,
  {
    titleKey: string;
    subtitleKey: string;
    metrics: Array<{ label: string; value: string; description: string; tone?: "neutral" | "good" | "warning" | "bad" }>;
    insight: { title: string; body: string; badge: string };
    listTitle: string;
    items: Array<{ title: string; description: string; value: string; tone?: "neutral" | "good" | "warning" | "bad" }>;
    chartTitle: string;
    bars: Array<{ label: string; value: number; color: string }>;
  }
> = {
  status: {
    titleKey: "status.title",
    subtitleKey: "status.subtitle",
    metrics: [
      { label: "ingestion", value: "99.98%", description: "최근 24시간 수집 성공률", tone: "good" },
      { label: "api latency", value: "182ms", description: "p95 write latency" },
      { label: "queue", value: "312", description: "대기 중인 이벤트" },
      { label: "dropped", value: "0.04%", description: "timeout 이후 폐기율", tone: "warning" },
    ],
    insight: {
      title: "수집 파이프라인은 정상입니다.",
      body: "production 이벤트는 정상 수집 중이고, staging workspace에서만 짧은 queue 증가가 관측됩니다.",
      badge: "healthy",
    },
    listTitle: "최근 상태 신호",
    items: [
      { title: "event collector", description: "events:write endpoint", value: "healthy", tone: "good" },
      { title: "policy cache", description: "SDK policy sync", value: "fresh", tone: "good" },
      { title: "metrics rollup", description: "hourly aggregation", value: "2m lag" },
      { title: "alert webhook", description: "Slack delivery", value: "degraded", tone: "warning" },
      { title: "retention worker", description: "raw payload pruning", value: "healthy", tone: "good" },
    ],
    chartTitle: "수집량",
    bars: [
      { label: "06", value: 42, color: "bg-emerald-500" },
      { label: "08", value: 56, color: "bg-emerald-500" },
      { label: "10", value: 61, color: "bg-emerald-500" },
      { label: "12", value: 48, color: "bg-emerald-500" },
      { label: "14", value: 72, color: "bg-emerald-500" },
    ],
  },
  cost: {
    titleKey: "cost.title",
    subtitleKey: "cost.subtitle",
    metrics: [
      { label: "today", value: "$184.20", description: "어제 대비 +8.4%", tone: "warning" },
      { label: "week", value: "$1,204", description: "예산의 61%" },
      { label: "month", value: "$4,882", description: "월 예산의 49%" },
      { label: "avg/run", value: "$0.086", description: "상위 agent 기준" },
    ],
    insight: {
      title: "리서치 agent 비용이 빠르게 증가했습니다.",
      body: "긴 컨텍스트 세션과 retry가 겹친 실행이 오늘 비용 증가의 주요 후보입니다.",
      badge: "watch",
    },
    listTitle: "비용 상위 agent",
    items: [
      { title: "리서치 요약 agent", description: "긴 컨텍스트와 LLM retry", value: "$62.40", tone: "warning" },
      { title: "환불 상담 agent", description: "고객 상담 production", value: "$48.12" },
      { title: "고객 지원 agent", description: "PII guardrail 포함", value: "$31.72" },
      { title: "온콜 triage agent", description: "야간 batch run", value: "$22.09" },
      { title: "문서 검색 agent", description: "retriever span 중심", value: "$19.87" },
    ],
    chartTitle: "시간대별 비용",
    bars: [
      { label: "06", value: 28, color: "bg-blue-500" },
      { label: "08", value: 42, color: "bg-blue-500" },
      { label: "10", value: 65, color: "bg-amber-500" },
      { label: "12", value: 58, color: "bg-blue-500" },
      { label: "14", value: 76, color: "bg-amber-500" },
    ],
  },
  sessionsOverview: {
    titleKey: "sessions.overview.title",
    subtitleKey: "sessions.overview.subtitle",
    metrics: [
      { label: "sessions", value: "1,284", description: "최근 24시간" },
      { label: "success", value: "94.8%", description: "정상 완료", tone: "good" },
      { label: "failed", value: "42", description: "조사 필요", tone: "bad" },
      { label: "p95", value: "8.4s", description: "실행 시간" },
    ],
    insight: {
      title: "실패 세션은 특정 agent에 집중되어 있습니다.",
      body: "환불 상담 agent와 리서치 요약 agent의 정책 차단, retry 패턴을 먼저 확인하세요.",
      badge: "triage",
    },
    listTitle: "최근 세션",
    items: [
      { title: "ses_9W2K1M", description: "환불 상담 agent / blocked", value: "critical", tone: "bad" },
      { title: "ses_4Q8V7R", description: "리서치 요약 agent / loop", value: "warning", tone: "warning" },
      { title: "ses_1HN6CC", description: "고객 지원 agent / PII blocked", value: "critical", tone: "bad" },
      { title: "ses_8MC2PA", description: "문서 검색 agent / completed", value: "normal", tone: "good" },
      { title: "ses_3KP91Q", description: "온콜 triage agent / completed", value: "normal", tone: "good" },
    ],
    chartTitle: "세션 볼륨",
    bars: [
      { label: "06", value: 34, color: "bg-slate-500" },
      { label: "08", value: 48, color: "bg-slate-500" },
      { label: "10", value: 72, color: "bg-slate-500" },
      { label: "12", value: 54, color: "bg-slate-500" },
      { label: "14", value: 83, color: "bg-slate-500" },
    ],
  },
  sessionsCompleted: {
    titleKey: "sessions.completed.title",
    subtitleKey: "sessions.completed.subtitle",
    metrics: [
      { label: "completed", value: "1,128", description: "최근 24시간", tone: "good" },
      { label: "avg duration", value: "4.2s", description: "정상 세션 평균" },
      { label: "avg cost", value: "$0.041", description: "세션당 비용" },
      { label: "no issue", value: "92%", description: "이슈 없는 완료", tone: "good" },
    ],
    insight: {
      title: "정상 세션 기준선이 안정적입니다.",
      body: "완료 세션은 비용과 지연 시간이 모두 기존 기준선 안에 있습니다.",
      badge: "baseline",
    },
    listTitle: "대표 완료 세션",
    items: [
      { title: "ses_8MC2PA", description: "문서 검색 agent", value: "3.8s", tone: "good" },
      { title: "ses_3KP91Q", description: "온콜 triage agent", value: "4.1s", tone: "good" },
      { title: "ses_6AV8HD", description: "고객 지원 agent", value: "5.0s", tone: "good" },
      { title: "ses_7TM2PQ", description: "리서치 요약 agent", value: "6.2s" },
      { title: "ses_2NZ7YR", description: "환불 상담 agent", value: "4.7s", tone: "good" },
    ],
    chartTitle: "완료 세션",
    bars: [
      { label: "06", value: 30, color: "bg-emerald-500" },
      { label: "08", value: 45, color: "bg-emerald-500" },
      { label: "10", value: 66, color: "bg-emerald-500" },
      { label: "12", value: 49, color: "bg-emerald-500" },
      { label: "14", value: 78, color: "bg-emerald-500" },
    ],
  },
  sessionsFailed: {
    titleKey: "sessions.failed.title",
    subtitleKey: "sessions.failed.subtitle",
    metrics: [
      { label: "failed", value: "42", description: "최근 24시간", tone: "bad" },
      { label: "blocked", value: "18", description: "정책 차단", tone: "warning" },
      { label: "retry", value: "31", description: "재시도 포함", tone: "warning" },
      { label: "top cause", value: "tool", description: "도구 timeout" },
    ],
    insight: {
      title: "실패는 tool call 직전과 직후에 몰려 있습니다.",
      body: "고액 환불 차단과 외부 API timeout이 오늘 실패 세션의 주요 후보입니다.",
      badge: "critical",
    },
    listTitle: "실패 세션",
    items: [
      { title: "ses_9W2K1M", description: "refundInvoice blocked", value: "critical", tone: "bad" },
      { title: "ses_1HN6CC", description: "PII output blocked", value: "critical", tone: "bad" },
      { title: "ses_4Q8V7R", description: "plan loop detected", value: "warning", tone: "warning" },
      { title: "ses_5BR1XD", description: "Slack timeout retry x3", value: "warning", tone: "warning" },
      { title: "ses_0KQ7LM", description: "context overload", value: "warning", tone: "warning" },
    ],
    chartTitle: "실패 추이",
    bars: [
      { label: "06", value: 12, color: "bg-rose-500" },
      { label: "08", value: 20, color: "bg-rose-500" },
      { label: "10", value: 31, color: "bg-rose-500" },
      { label: "12", value: 22, color: "bg-rose-500" },
      { label: "14", value: 38, color: "bg-rose-500" },
    ],
  },
  agentsOverview: {
    titleKey: "agents.overview.title",
    subtitleKey: "agents.overview.subtitle",
    metrics: [
      { label: "agents", value: "18", description: "등록 agent" },
      { label: "active", value: "14", description: "최근 10분 실행", tone: "good" },
      { label: "at risk", value: "3", description: "이슈 연결", tone: "warning" },
      { label: "inactive", value: "4", description: "최근 실행 없음" },
    ],
    insight: {
      title: "활성 agent 대부분은 정상입니다.",
      body: "위험 신호는 환불 상담, 리서치 요약, 고객 지원 agent에 집중되어 있습니다.",
      badge: "overview",
    },
    listTitle: "agent 상태",
    items: [
      { title: "환불 상담 agent", description: "정책 차단 증가", value: "critical", tone: "bad" },
      { title: "리서치 요약 agent", description: "반복 계획 감지", value: "warning", tone: "warning" },
      { title: "고객 지원 agent", description: "PII 차단", value: "critical", tone: "bad" },
      { title: "문서 검색 agent", description: "정상 실행", value: "healthy", tone: "good" },
      { title: "온콜 triage agent", description: "정상 실행", value: "healthy", tone: "good" },
    ],
    chartTitle: "agent별 실행량",
    bars: [
      { label: "환불", value: 62, color: "bg-blue-500" },
      { label: "리서치", value: 74, color: "bg-blue-500" },
      { label: "지원", value: 58, color: "bg-blue-500" },
      { label: "검색", value: 44, color: "bg-blue-500" },
      { label: "온콜", value: 38, color: "bg-blue-500" },
    ],
  },
  agentsActive: {
    titleKey: "agents.active.title",
    subtitleKey: "agents.active.subtitle",
    metrics: [
      { label: "active", value: "14", description: "실행 중 또는 최근 실행", tone: "good" },
      { label: "running", value: "6", description: "현재 진행 중" },
      { label: "blocked", value: "2", description: "정책 차단", tone: "warning" },
      { label: "avg p95", value: "7.8s", description: "활성 agent 기준" },
    ],
    insight: {
      title: "활성 agent의 위험 신호를 먼저 보세요.",
      body: "실시간 운영에서는 차단 이벤트가 있는 agent를 우선 확인하는 것이 좋습니다.",
      badge: "active",
    },
    listTitle: "활성 agent",
    items: [
      { title: "환불 상담 agent", description: "production / 42 runs", value: "blocked", tone: "warning" },
      { title: "리서치 요약 agent", description: "production / 51 runs", value: "warning", tone: "warning" },
      { title: "고객 지원 agent", description: "production / 36 runs", value: "blocked", tone: "warning" },
      { title: "문서 검색 agent", description: "production / 28 runs", value: "healthy", tone: "good" },
      { title: "온콜 triage agent", description: "staging / 19 runs", value: "healthy", tone: "good" },
    ],
    chartTitle: "활성 실행",
    bars: [
      { label: "06", value: 28, color: "bg-emerald-500" },
      { label: "08", value: 36, color: "bg-emerald-500" },
      { label: "10", value: 52, color: "bg-emerald-500" },
      { label: "12", value: 47, color: "bg-emerald-500" },
      { label: "14", value: 59, color: "bg-emerald-500" },
    ],
  },
  agentsInactive: {
    titleKey: "agents.inactive.title",
    subtitleKey: "agents.inactive.subtitle",
    metrics: [
      { label: "inactive", value: "4", description: "최근 24시간 실행 없음" },
      { label: "stale policy", value: "1", description: "정책 캐시 오래됨", tone: "warning" },
      { label: "no sdk ping", value: "2", description: "SDK heartbeat 없음", tone: "warning" },
      { label: "archived", value: "0", description: "보관 처리 없음", tone: "good" },
    ],
    insight: {
      title: "비활성 agent는 설정 확인이 필요합니다.",
      body: "SDK heartbeat가 없는 agent는 배포 중단인지, 계측 누락인지 구분해야 합니다.",
      badge: "inactive",
    },
    listTitle: "비활성 agent",
    items: [
      { title: "invoice helper", description: "last seen 2d ago", value: "stale", tone: "warning" },
      { title: "docs qa agent", description: "last seen 4d ago", value: "inactive" },
      { title: "sales summary agent", description: "last seen 7d ago", value: "inactive" },
      { title: "sandbox agent", description: "last seen 10d ago", value: "inactive" },
    ],
    chartTitle: "마지막 실행 분포",
    bars: [
      { label: "1d", value: 12, color: "bg-slate-400" },
      { label: "2d", value: 22, color: "bg-slate-400" },
      { label: "4d", value: 36, color: "bg-slate-400" },
      { label: "7d", value: 44, color: "bg-slate-400" },
      { label: "10d", value: 52, color: "bg-slate-400" },
    ],
  },
};

export function DashboardOperationalPage({ kind }: { kind: DashboardPageKind }) {
  const t = useTranslations("dashboard");
  const page = pageData[kind];

  return (
    <div className="space-y-5">
      <DashboardPageHeader title={t(page.titleKey)} description={t(page.subtitleKey)} />
      <section className="grid gap-3 md:grid-cols-4">
        {page.metrics.map((metric) => (
          <OperationsKpiCard
            description={metric.description}
            key={metric.label}
            label={metric.label}
            tone={metric.tone}
            value={metric.value}
          />
        ))}
      </section>
      <DashboardPanel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <OperationsBadge className={getStateClass(page.insight.badge)}>{page.insight.badge}</OperationsBadge>
            <h2 className="mt-3 text-sm font-bold">{page.insight.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{page.insight.body}</p>
          </div>
        </div>
      </DashboardPanel>
      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <DashboardListPanel empty={page.items.length === 0} emptyText={t("empty")}>
          <h2 className="px-2 pb-2 text-sm font-bold">{page.listTitle}</h2>
          {page.items.map((item) => (
            <DashboardListRow
              description={item.description}
              key={item.title}
              title={item.title}
              tone={item.tone}
              value={item.value}
            />
          ))}
        </DashboardListPanel>
        <DashboardChartPanel>
          <h2 className="text-sm font-bold">{page.chartTitle}</h2>
          <div className="mt-6 flex h-64 items-end gap-3">
            {page.bars.map((bar) => (
              <div className="flex flex-1 flex-col items-center gap-2" key={bar.label}>
                <div className={`${bar.color} w-full rounded-t-md`} style={{ height: `${Math.max(10, bar.value * 2)}px` }} />
                <span className="text-xs text-muted-foreground">{bar.label}</span>
              </div>
            ))}
          </div>
        </DashboardChartPanel>
      </section>
    </div>
  );
}
