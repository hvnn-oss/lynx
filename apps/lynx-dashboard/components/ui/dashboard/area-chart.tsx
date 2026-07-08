"use client";

import { useId, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@repo/ui/components/ui/chart";
import { cn } from "@/lib/utils";

type ChartDatum = Record<string, string | number>;

interface DashboardAreaChartProps {
  chartData: ChartDatum[];
  chartConfig: ChartConfig;
  categoryKey: string;
  /** 시리즈 2개 이상일 때 스택 여부. "expand"는 100% 스택(비율) */
  stacked?: boolean | "auto" | "expand";
  /** 곡선 형태 */
  curveType?: "natural" | "linear" | "step" | "monotone";
  showLegend?: boolean;
  /** 그라데이션 채우기 (위에서 아래로 옅어지는 스타일) */
  gradient?: boolean;
  connectNulls?: boolean;
  tickFormatter?: (value: string) => string;
  className?: string;
}

export function DashboardAreaChart({
  chartData,
  chartConfig,
  categoryKey,
  stacked = "auto",
  curveType = "natural",
  showLegend,
  gradient = false,
  connectNulls = false,
  tickFormatter = (value) => String(value).slice(0, 3),
  className,
}: DashboardAreaChartProps) {
  const gradientId = useId();

  const seriesKeys = useMemo(
    () => Object.keys(chartConfig).filter((key) => key !== categoryKey),
    [chartConfig, categoryKey],
  );

  const isMultiSeries = seriesKeys.length > 1;
  const isStacked =
    stacked === "auto" ? isMultiSeries : stacked === "expand" ? true : stacked;
  const stackOffset = stacked === "expand" ? "expand" : undefined;
  const showLegendResolved = showLegend ?? isMultiSeries;

  return (
    <ChartContainer
      config={chartConfig}
      className={cn(className, "min-h-[200px] w-full")}
    >
      <AreaChart
        accessibilityLayer
        data={chartData}
        stackOffset={stackOffset}
        margin={{ left: 12, right: 12 }}
      >
        {gradient && (
          <defs>
            {seriesKeys.map((key) => (
              <linearGradient
                key={key}
                id={`${gradientId}-${key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={`var(--color-${key})`}
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor={`var(--color-${key})`}
                  stopOpacity={0.1}
                />
              </linearGradient>
            ))}
          </defs>
        )}

        <CartesianGrid vertical={false} />
        <XAxis
          dataKey={categoryKey}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={tickFormatter}
        />

        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="line" />}
        />
        {showLegendResolved && <ChartLegend content={<ChartLegendContent />} />}

        {seriesKeys.map((key) => (
          <Area
            key={key}
            dataKey={key}
            type={curveType}
            stackId={isStacked ? "stack" : undefined}
            fill={
              gradient ? `url(#${gradientId}-${key})` : `var(--color-${key})`
            }
            fillOpacity={gradient ? 1 : 0.4}
            stroke={`var(--color-${key})`}
            connectNulls={connectNulls}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}
