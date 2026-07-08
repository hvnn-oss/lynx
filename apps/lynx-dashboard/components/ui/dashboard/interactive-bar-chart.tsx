"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@repo/ui/components/ui/chart";

interface InteractiveBarChartProps {
  chartData: Record<string, string | number>[];
  chartConfig: ChartConfig;
  categoryKey: string;
  title?: string;
  description?: string;
  tickFormatter?: (value: string) => string;
}

export function InteractiveBarChart({
  chartData,
  chartConfig,
  categoryKey,
  title = "Bar Chart - Interactive",
  description,
  tickFormatter = (value) => String(value).slice(0, 3),
}: InteractiveBarChartProps) {
  const seriesKeys = React.useMemo(
    () => Object.keys(chartConfig),
    [chartConfig],
  );
  const [activeSeries, setActiveSeries] = React.useState(seriesKeys[0]);

  const totals = React.useMemo(
    () =>
      seriesKeys.reduce<Record<string, number>>((acc, key) => {
        acc[key] = chartData.reduce((sum, d) => sum + (Number(d[key]) || 0), 0);
        return acc;
      }, {}),
    [chartData, seriesKeys],
  );

  return (
    <Card>
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <div className="flex">
          {seriesKeys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveSeries(key)}
              data-active={activeSeries === key}
              className="data-[active=true]:bg-muted/50 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6"
            >
              <span className="text-muted-foreground text-xs">
                {chartConfig[key]?.label ?? key}
              </span>
              <span className="text-lg leading-none font-bold sm:text-3xl">
                {totals[key]?.toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-62.5 w-full"
        >
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 12, right: 12 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={categoryKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={tickFormatter}
            />
            <ChartTooltip
              content={<ChartTooltipContent className="w-37.5" />}
            />
            <Bar
              dataKey={activeSeries}
              fill={`var(--color-${activeSeries})`}
              radius={4}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
