import type { DashboardHomeMetricsDto } from "@repo/dto";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@repo/ui/components/ui/chart";
import { DashboardChartPanel } from "@repo/ui/components/dashboard/panel";
import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartSkeleton } from "../shared/skeletons";

type RunVolumeItem = DashboardHomeMetricsDto["runVolume"][number];
type RunVolumeChartItem = RunVolumeItem & {
  label: string;
  fullLabel: string;
  successCount: number;
  failedCount: number;
};
type ChartTooltipPayload<T> = Array<{
  color?: string;
  dataKey?: string;
  payload?: T;
  value?: number | string;
}>;

interface RunVolumeProps {
  data?: RunVolumeItem[];
  isLoading?: boolean;
}

export function RunVolume({ data, isLoading = false }: RunVolumeProps) {
  const t = useTranslations("dashboard.home.charts");
  const chartConfig = {
    successCount: {
      label: t("success"),
      color: "#10b981",
    },
    failedCount: {
      label: t("failure"),
      color: "#f43f5e",
    },
  } satisfies ChartConfig;

  if (isLoading || !data) {
    return <ChartSkeleton className="h-full" height="h-48" />;
  }

  const chartData = data.map((item) => {
    const failedCount = item.failedCount ?? 0;
    const successCount =
      item.successCount ?? Math.max(item.count - failedCount, 0);

    return {
      ...item,
      label: formatHour(item.time),
      fullLabel: formatFullTime(item.time),
      successCount,
      failedCount,
    };
  });

  return (
    <DashboardChartPanel
      className="h-full"
      empty={chartData.length === 0}
      emptyText={t("empty")}
    >
      <ChartContainer config={chartConfig} className="h-64 min-h-64 w-full">
        <BarChart data={chartData} margin={{ left: -18, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={20}
          />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={36} />
          <ChartTooltip
            cursor={{ fill: "var(--muted)", opacity: 0.35 }}
            content={<RunVolumeTooltip />}
          />
          <Bar
            dataKey="successCount"
            stackId="runs"
            fill="var(--color-successCount)"
            radius={[0, 0, 4, 4]}
          />
          <Bar
            dataKey="failedCount"
            stackId="runs"
            fill="var(--color-failedCount)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
      <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-emerald-500" />
          {t("success")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-rose-500" />
          {t("failure")}
        </span>
      </div>
    </DashboardChartPanel>
  );
}

function RunVolumeTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ChartTooltipPayload<RunVolumeChartItem>;
}) {
  const t = useTranslations("dashboard.home.charts");
  const item = payload?.[0]?.payload;

  if (!active || !item) return null;

  const totalRuns = item.successCount + item.failedCount;

  return (
    <div className="min-w-40 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs">
      <p className="font-medium">{t("timeLabel", { time: item.fullLabel })}</p>
      <div className="mt-2 grid gap-1.5">
        <TooltipRow
          color="#10b981"
          label={t("success")}
          value={t("runsValue", {
            value: numberFormatter.format(item.successCount),
          })}
        />
        <TooltipRow
          color="#f43f5e"
          label={t("failure")}
          value={t("runsValue", {
            value: numberFormatter.format(item.failedCount),
          })}
        />
        <TooltipRow
          label={t("totalRuns")}
          value={t("runsValue", { value: numberFormatter.format(totalRuns) })}
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
  color?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        {color ? (
          <span
            className="size-2 rounded-sm"
            style={{ backgroundColor: color }}
          />
        ) : null}
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

const numberFormatter = new Intl.NumberFormat("ko-KR");
