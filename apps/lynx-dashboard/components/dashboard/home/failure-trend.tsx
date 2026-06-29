import type { DashboardHomeMetricsDto } from "@repo/dto";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@repo/ui/components/ui/chart";
import { DashboardChartPanel } from "@repo/ui/components/dashboard/panel";
import { useTranslations } from "next-intl";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartSkeleton } from "../shared/skeletons";

type FailureTrendItem = DashboardHomeMetricsDto["failureTrend"][number];
type FailureTrendChartItem = FailureTrendItem & {
  label: string;
  fullLabel: string;
  previousRate: number;
};
type ChartTooltipPayload<T> = Array<{
  color?: string;
  dataKey?: string;
  payload?: T;
  value?: number | string;
}>;

interface FailureTrendProps {
  data?: FailureTrendItem[];
  isLoading?: boolean;
}

export function FailureTrend({ data, isLoading = false }: FailureTrendProps) {
  const t = useTranslations("dashboard.home.charts");
  const chartConfig = {
    rate: {
      label: t("currentFailureRate"),
      color: "#f43f5e",
    },
    previousRate: {
      label: t("previousPeriod"),
      color: "#94a3b8",
    },
  } satisfies ChartConfig;

  if (isLoading || !data) {
    return <ChartSkeleton className="h-full" height="h-48" />;
  }

  const chartData = data.map((item, index) => ({
    ...item,
    label: formatHour(item.time),
    fullLabel: formatFullTime(item.time),
    previousRate:
      item.previousRate ??
      (index > 0 ? (data[index - 1]?.rate ?? item.rate) : item.rate),
  }));

  return (
    <DashboardChartPanel
      className="h-full"
      empty={chartData.length === 0}
      emptyText={t("empty")}
    >
      <ChartContainer config={chartConfig} className="h-64 min-h-64 w-full">
        <LineChart data={chartData} margin={{ left: -18, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={20}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={36}
            tickFormatter={(value) => `${value}%`}
          />
          <ChartTooltip
            cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
            content={<FailureTrendTooltip />}
          />
          <Line
            type="monotone"
            dataKey="previousRate"
            stroke="var(--color-previousRate)"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            activeDot={{ r: 3, strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="rate"
            stroke="var(--color-rate)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2 }}
          />
        </LineChart>
      </ChartContainer>
      <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-rose-500" />
          {t("currentFailureRate")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3 bg-slate-400" />
          {t("previousPeriod")}
        </span>
      </div>
    </DashboardChartPanel>
  );
}

function FailureTrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ChartTooltipPayload<FailureTrendChartItem>;
}) {
  const t = useTranslations("dashboard.home.charts");
  const item = payload?.[0]?.payload;

  if (!active || !item) return null;

  return (
    <div className="min-w-44 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs">
      <p className="font-medium">{t("timeLabel", { time: item.fullLabel })}</p>
      <div className="mt-2 grid gap-1.5">
        <TooltipRow
          color="#f43f5e"
          label={t("currentFailureRate")}
          value={t("failureRateValue", { value: item.rate.toFixed(2) })}
        />
        <TooltipRow
          color="#94a3b8"
          label={t("previousPeriod")}
          value={t("failureRateValue", { value: item.previousRate.toFixed(2) })}
        />
      </div>
    </div>
  );
}

function TooltipRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span
          className="size-2 rounded-sm"
          style={{ backgroundColor: color }}
        />
        {label}
      </span>
      <span className="font-mono font-medium tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

function formatHour(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
  }).format(date);
}

function formatFullTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
