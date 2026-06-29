import type { DashboardHomeMetricsDto } from "@repo/dto";
import { useTranslations } from "next-intl";
import { CardSkeleton } from "../shared/skeletons";
import { cn } from "@/lib/utils";

type Kpis = DashboardHomeMetricsDto["kpis"];

interface KpiCardsProps {
  data?: Kpis;
  isLoading?: boolean;
}

type ChangeTone = "good" | "bad" | "neutral";

interface KpiCard {
  label: string;
  value: string;
  changeLabel: string;
  tone: ChangeTone;
}

const numberFormatter = new Intl.NumberFormat("ko-KR");
const compactFormatter = new Intl.NumberFormat("ko-KR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const currencyFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function KpiCards({ data, isLoading = false }: KpiCardsProps) {
  const t = useTranslations("dashboard.home.kpis");

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    );
  }

  const hasRuns = data.agentRuns.value > 0;
  const failureRate = hasRuns ? Math.max(0, 100 - data.successRate.value) : null;
  const failureRateChange = -data.successRate.change;
  const cards: KpiCard[] = [
    {
      label: t("runs"),
      value: compactFormatter.format(data.agentRuns.value),
      changeLabel:
        data.agentRuns.change === 0
          ? t("sameAsYesterday")
          : t("yesterdayPercent", {
              value: `${formatSignedNumber(data.agentRuns.change)}%`,
            }),
      tone: data.agentRuns.change >= 0 ? "good" : "bad",
    },
    {
      label: t("failureRate"),
      value:
        failureRate === null
          ? "-"
          : t("percentValue", { value: failureRate.toFixed(1) }),
      changeLabel:
        failureRate === null
          ? t("noRuns")
          : failureRateChange === 0
            ? t("sameAsYesterday")
            : t("yesterdayPoint", {
                value: t("pointValue", {
                  value: formatSignedNumber(failureRateChange),
                }),
              }),
      tone: failureRate === null ? "neutral" : getBadWhenUpTone(failureRateChange),
    },
    {
      label: t("latency"),
      value: hasRuns
        ? t("secondsValue", { value: data.avgLatency.value.toFixed(2) })
        : "-",
      changeLabel:
        !hasRuns || data.avgLatency.change === 0
          ? t("sameAsLast24Hours")
          : t("last24HoursSeconds", {
              value: t("secondsValue", {
                value: formatSignedNumber(data.avgLatency.change),
              }),
            }),
      tone: hasRuns ? getBadWhenUpTone(data.avgLatency.change) : "neutral",
    },
    {
      label: t("cost"),
      value: currencyFormatter.format(data.cost.value),
      changeLabel:
        data.cost.change === 0
          ? t("sameAsYesterday")
          : t("yesterdayPercent", {
              value: `${formatSignedNumber(data.cost.change)}%`,
            }),
      tone: data.cost.change < 0 ? "good" : "neutral",
    },
    {
      label: t("riskEvents"),
      value: t("eventsValue", {
        value: numberFormatter.format(data.criticalAlerts.value),
      }),
      changeLabel:
        data.criticalAlerts.change === 0
          ? t("sameAsLast24Hours")
          : t("last24HoursCount", {
              value: t("eventsValue", {
                value: formatSignedNumber(data.criticalAlerts.change),
              }),
            }),
      tone: getBadWhenUpTone(data.criticalAlerts.change),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <KpiCardView key={card.label} card={card} />
      ))}
    </div>
  );
}

function KpiCardView({ card }: { card: KpiCard }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 p-4">
      <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
      <p className="mt-3 truncate text-3xl font-semibold tracking-normal">
        {card.value}
      </p>
      <p
        className={cn(
          "mt-2 truncate text-xs font-medium",
          card.tone === "bad" && "text-rose-700",
          card.tone === "good" && "text-emerald-700",
          card.tone === "neutral" && "text-muted-foreground",
        )}
      >
        {card.changeLabel}
      </p>
    </div>
  );
}

function getBadWhenUpTone(value: number): ChangeTone {
  if (value > 0) return "bad";
  if (value < 0) return "good";
  return "neutral";
}

function formatSignedNumber(value = 0) {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}
