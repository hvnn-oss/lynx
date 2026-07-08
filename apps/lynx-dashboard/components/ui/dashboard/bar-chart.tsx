"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@repo/ui/components/ui/chart";
import { cn } from "@/lib/utils";

type ChartDatum = Record<string, string | number> & { fill?: string };

interface DashboardBarChartProps {
  chartData: ChartDatum[];
  chartConfig: ChartConfig;
  categoryKey: string;
  orientation?: "vertical" | "horizontal";
  stacked?: boolean | "auto";
  showValueLabel?: boolean;
  activeIndex?: number;
  showLegend?: boolean;
  colorByCategory?: boolean;
  negativeColors?: { positive: string; negative: string };
  tickFormatter?: (value: string) => string;
  barRadius?: number;
  className?: string;
}

export function DashboardBarChart({
  chartData,
  chartConfig,
  categoryKey,
  orientation = "vertical",
  stacked = "auto",
  showValueLabel = false,
  activeIndex,
  showLegend,
  colorByCategory = false,
  negativeColors,
  tickFormatter = (value) => String(value).slice(0, 3),
  barRadius = 4,
  className,
}: DashboardBarChartProps) {
  const seriesKeys = useMemo(
    () => Object.keys(chartConfig).filter((key) => key !== categoryKey),
    [chartConfig, categoryKey],
  );

  const isMultiSeries = seriesKeys.length > 1;
  const isStacked = stacked === "auto" ? isMultiSeries : stacked;
  const isHorizontal = orientation === "horizontal";
  const showLegendResolved = showLegend ?? isMultiSeries;

  const hasNegative =
    seriesKeys.length === 1 &&
    chartData.some((d) => Number(d[seriesKeys[0]]) < 0);

  const resolvedNegativeColors = negativeColors ?? {
    positive: "var(--chart-1)",
    negative: "var(--destructive)",
  };

  return (
    <ChartContainer
      config={chartConfig}
      className={cn(className, "min-h-52 w-full")}
    >
      <BarChart
        accessibilityLayer
        data={chartData}
        layout={isHorizontal ? "vertical" : "horizontal"}
        margin={isHorizontal ? { left: 8 } : undefined}
      >
        <CartesianGrid horizontal={!isHorizontal} vertical={isHorizontal} />

        {isHorizontal ? (
          <>
            <XAxis type="number" hide />
            <YAxis
              dataKey={categoryKey}
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={tickFormatter}
              width={80}
            />
          </>
        ) : (
          <XAxis
            dataKey={categoryKey}
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            tickFormatter={tickFormatter}
          />
        )}

        {hasNegative && !isHorizontal && (
          <ReferenceLine y={0} stroke="var(--border)" />
        )}

        <ChartTooltip content={<ChartTooltipContent />} />
        {showLegendResolved && <ChartLegend content={<ChartLegendContent />} />}

        {seriesKeys.map((key, index) => {
          const isFirst = index === 0;
          const isLast = index === seriesKeys.length - 1;

          const radius: number | [number, number, number, number] = !isStacked
            ? barRadius
            : isHorizontal
              ? isLast
                ? [0, barRadius, barRadius, 0]
                : isFirst
                  ? [barRadius, 0, 0, barRadius]
                  : 0
              : isLast
                ? [barRadius, barRadius, 0, 0]
                : isFirst
                  ? [0, 0, barRadius, barRadius]
                  : 0;

          // mixed(colorByCategory) / negative / active 강조, 셋 중 하나라도 필요하면 Cell로 그림
          const useCellColoring =
            seriesKeys.length === 1 &&
            (colorByCategory || hasNegative || activeIndex !== undefined);

          return (
            <Bar
              key={key}
              dataKey={key}
              stackId={isStacked ? "stack" : undefined}
              fill={`var(--color-${key})`}
              radius={radius}
            >
              {showValueLabel && (
                <LabelList
                  dataKey={key}
                  position={isHorizontal ? "right" : "top"}
                  className="fill-foreground"
                  fontSize={12}
                />
              )}

              {useCellColoring &&
                chartData.map((entry, i) => {
                  const baseFill =
                    colorByCategory && entry.fill
                      ? entry.fill
                      : hasNegative
                        ? Number(entry[key]) >= 0
                          ? resolvedNegativeColors.positive
                          : resolvedNegativeColors.negative
                        : `var(--color-${key})`;

                  const isActive = activeIndex === i;

                  return (
                    <Cell
                      key={`cell-${i}`}
                      fill={baseFill}
                      fillOpacity={
                        activeIndex === undefined || isActive ? 1 : 0.3
                      }
                      stroke={isActive ? baseFill : undefined}
                      strokeWidth={isActive ? 2 : undefined}
                      strokeDasharray={isActive ? 4 : undefined}
                    />
                  );
                })}
            </Bar>
          );
        })}
      </BarChart>
    </ChartContainer>
  );
}
