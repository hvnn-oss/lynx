import type { DashboardHomeMetricsDto } from "@repo/dto";
import type { ComponentType } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Clock,
  DollarSign,
  Gauge,
} from "lucide-react";
import { CardSkeleton } from "../shared/skeletons";

type Kpis = DashboardHomeMetricsDto["kpis"];

interface KpiCardsProps {
  data?: Kpis;
  isLoading?: boolean;
}

interface KpiCard {
  label: string;
  value: string;
  change?: number;
  trend?: "up" | "down";
  icon: ComponentType<{ className?: string }>;
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
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    );
  }

  const cards: KpiCard[] = [
    {
      label: "Active Agents",
      value: numberFormatter.format(data.activeAgents.value),
      icon: Activity,
    },
    {
      label: "Agent Runs",
      value: compactFormatter.format(data.agentRuns.value),
      change: data.agentRuns.change,
      trend: data.agentRuns.trend,
      icon: Bot,
    },
    {
      label: "Success Rate",
      value: `${data.successRate.value.toFixed(1)}%`,
      change: data.successRate.change,
      trend: data.successRate.trend,
      icon: Gauge,
    },
    {
      label: "Avg Latency",
      value: `${data.avgLatency.value.toFixed(2)}s`,
      change: data.avgLatency.change,
      trend: data.avgLatency.trend,
      icon: Clock,
    },
    {
      label: "Cost",
      value: `$${data.cost.value}`,
      change: data.cost.change,
      trend: data.cost.trend,
      icon: DollarSign,
    },
    {
      label: "Critical Alerts",
      value: numberFormatter.format(data.criticalAlerts.value),
      change: data.criticalAlerts.change,
      trend: data.criticalAlerts.trend,
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const positive = card.trend === "up";

        return (
          <div
            key={card.label}
            className="rounded-xl border border-border/40 bg-card/30 p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-medium text-muted-foreground">
                {card.label}
              </p>
              <span className="rounded-lg border border-border/50 bg-background p-2 text-muted-foreground">
                <Icon className="size-4" />
              </span>
            </div>
            <div className="flex items-end justify-between">
              <p className="truncate text-4xl font-semibold tracking-normal">
                {card.value}
              </p>
              {"change" in card && typeof card.change === "number" ? (
                <p
                  className={
                    positive
                      ? "text-sm font-medium text-emerald-600"
                      : "text-sm font-medium text-rose-600"
                  }
                >
                  {positive ? "+" : ""}
                  {card.change.toFixed(1)}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">현재 활성</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
