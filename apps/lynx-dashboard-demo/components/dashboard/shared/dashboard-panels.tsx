"use client";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@repo/ui/components/ui/chart";
import {
  DashboardChartPanel,
  DashboardListPanel,
  DashboardListRow,
  DashboardMetricCard,
  DashboardRowSeparator,
} from "@repo/ui/components/dashboard/panel";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

export {
  DashboardMoreRow,
  getCappedItems,
} from "@repo/ui/components/dashboard/panel";

export const MetricCard = DashboardMetricCard;
export const ListPanel = DashboardListPanel;
export const ListRow = DashboardListRow;
export const RowSeparator = DashboardRowSeparator;

export const numberFormatter = new Intl.NumberFormat("ko-KR");
export const compactFormatter = new Intl.NumberFormat("ko-KR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
export const currencyFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

type ChartDatum = Record<string, string | number>;
type ValueFormatter = (value: string | number) => string;

export function BarPanel({
  data,
  dataKey,
  nameKey,
  label,
  color = "#2563eb",
  valueFormatter = formatChartValue,
}: {
  data: ChartDatum[];
  dataKey: string;
  nameKey: string;
  label?: string;
  color?: string;
  valueFormatter?: ValueFormatter;
}) {
  const config = {
    [dataKey]: { label: label ?? dataKey, color },
  } satisfies ChartConfig;

  return (
    <DashboardChartPanel
      empty={data.length === 0}
      emptyText="표시할 데이터가 없습니다."
    >
      <ChartContainer config={config} className="h-56 min-h-56 w-full">
        <BarChart
          accessibilityLayer
          data={data}
          layout="vertical"
          margin={{ left: 12, right: 20 }}
        >
          <CartesianGrid horizontal={false} />
          <XAxis type="number" hide />
          <YAxis
            dataKey={nameKey}
            type="category"
            tickLine={false}
            axisLine={false}
            width={92}
          />
          <ChartTooltip
            cursor={{ fill: "var(--muted)", opacity: 0.35 }}
            content={
              <ChartTooltipContent
                indicator="line"
                labelFormatter={(_, payload) =>
                  String(payload?.[0]?.payload?.[nameKey] ?? "")
                }
                formatter={(value, name) => (
                  <>
                    <span className="text-muted-foreground">
                      {config[String(name)]?.label ?? String(name)}
                    </span>
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {formatTooltipValue(value, valueFormatter)}
                    </span>
                  </>
                )}
              />
            }
          />
          <Bar dataKey={dataKey} fill={`var(--color-${dataKey})`} radius={4} />
        </BarChart>
      </ChartContainer>
    </DashboardChartPanel>
  );
}

export function LinePanel({
  data,
  dataKey,
  nameKey,
  label,
  color = "#2563eb",
  valueFormatter = formatChartValue,
}: {
  data: ChartDatum[];
  dataKey: string;
  nameKey: string;
  label?: string;
  color?: string;
  valueFormatter?: ValueFormatter;
}) {
  const config = {
    [dataKey]: { label: label ?? dataKey, color },
  } satisfies ChartConfig;

  return (
    <DashboardChartPanel
      empty={data.length === 0}
      emptyText="표시할 데이터가 없습니다."
    >
      <ChartContainer config={config} className="h-56 min-h-56 w-full">
        <LineChart
          accessibilityLayer
          data={data}
          margin={{ left: -18, right: 12, top: 8 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis dataKey={nameKey} tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={42} />
          <ChartTooltip
            cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
            content={
              <ChartTooltipContent
                indicator="line"
                labelFormatter={(value) => String(value)}
                formatter={(value, name) => (
                  <>
                    <span className="text-muted-foreground">
                      {config[String(name)]?.label ?? String(name)}
                    </span>
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {formatTooltipValue(value, valueFormatter)}
                    </span>
                  </>
                )}
              />
            }
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={`var(--color-${dataKey})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2 }}
          />
        </LineChart>
      </ChartContainer>
    </DashboardChartPanel>
  );
}

export function AreaPanel({
  data,
  dataKey,
  nameKey,
  label,
  color = "#0f766e",
  valueFormatter = formatChartValue,
}: {
  data: ChartDatum[];
  dataKey: string;
  nameKey: string;
  label?: string;
  color?: string;
  valueFormatter?: ValueFormatter;
}) {
  const config = {
    [dataKey]: { label: label ?? dataKey, color },
  } satisfies ChartConfig;

  return (
    <DashboardChartPanel
      empty={data.length === 0}
      emptyText="표시할 데이터가 없습니다."
    >
      <ChartContainer config={config} className="h-56 min-h-56 w-full">
        <AreaChart
          accessibilityLayer
          data={data}
          margin={{ left: -18, right: 12, top: 8 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis dataKey={nameKey} tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={42} />
          <ChartTooltip
            cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
            content={
              <ChartTooltipContent
                indicator="line"
                labelFormatter={(value) => String(value)}
                formatter={(value, name) => (
                  <>
                    <span className="text-muted-foreground">
                      {config[String(name)]?.label ?? String(name)}
                    </span>
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {formatTooltipValue(value, valueFormatter)}
                    </span>
                  </>
                )}
              />
            }
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={`var(--color-${dataKey})`}
            fill={`var(--color-${dataKey})`}
            fillOpacity={0.16}
            activeDot={{ r: 4, strokeWidth: 2 }}
          />
        </AreaChart>
      </ChartContainer>
    </DashboardChartPanel>
  );
}

export function PiePanel({
  data,
  dataKey,
  nameKey,
  colors,
  label,
  valueFormatter = formatChartValue,
}: {
  data: ChartDatum[];
  dataKey: string;
  nameKey: string;
  colors: string[];
  label?: string;
  valueFormatter?: ValueFormatter;
}) {
  const config = {
    [dataKey]: { label: label ?? dataKey },
    ...Object.fromEntries(
      data.map((item, index) => [
        String(item[nameKey]),
        { label: String(item[nameKey]), color: colors[index % colors.length] },
      ]),
    ),
  } satisfies ChartConfig;

  return (
    <DashboardChartPanel
      empty={data.length === 0}
      emptyText="표시할 데이터가 없습니다."
    >
      <ChartContainer config={config} className="mx-auto h-56 min-h-56 w-full">
        <PieChart accessibilityLayer>
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelKey={dataKey}
                nameKey={nameKey}
                formatter={(value, name) => (
                  <>
                    <span className="text-muted-foreground">
                      {config[String(name)]?.label ?? String(name)}
                    </span>
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {formatTooltipValue(value, valueFormatter)}
                    </span>
                  </>
                )}
              />
            }
          />
          <ChartLegend
            content={<ChartLegendContent nameKey={nameKey} />}
            verticalAlign="bottom"
          />
          <Pie
            data={data}
            dataKey={dataKey}
            nameKey={nameKey}
            innerRadius={52}
            outerRadius={82}
            paddingAngle={3}
          >
            {data.map((item, index) => (
              <Cell
                key={String(item[nameKey])}
                fill={colors[index % colors.length]}
              />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
    </DashboardChartPanel>
  );
}

export function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatChartValue(value: string | number) {
  if (typeof value === "number") return numberFormatter.format(value);
  return value;
}

function formatTooltipValue(
  value: unknown,
  formatter: ValueFormatter,
): string {
  if (typeof value === "number" || typeof value === "string") {
    return formatter(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatTooltipValue(item, formatter)).join(" - ");
  }

  return "-";
}
