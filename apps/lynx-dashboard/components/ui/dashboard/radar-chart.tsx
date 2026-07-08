"use client";

import { useMemo } from "react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";
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

interface DashboardRadarChartProps {
  chartData: ChartDatum[];
  chartConfig: ChartConfig;
  categoryKey: string;
  /** 꼭짓점에 점 표시 */
  showDots?: boolean;
  /** 라인만 그리고 채우기 없음 (fillOpacity 0) */
  linesOnly?: boolean;
  /** PolarGrid 스타일. "lines"(기본 다각형 격자), "circle"(원형 격자), "circle-fill"(원형 배경 채움) */
  gridType?: "lines" | "circle" | "circle-fill";
  showLegend?: boolean;
  fillOpacity?: number;
  className?: string;
}

export function DashboardRadarChart({
  chartData,
  chartConfig,
  categoryKey,
  showDots = false,
  linesOnly = false,
  gridType = "lines",
  showLegend,
  fillOpacity = 0.6,
  className,
}: DashboardRadarChartProps) {
  const seriesKeys = useMemo(
    () => Object.keys(chartConfig).filter((key) => key !== categoryKey),
    [chartConfig, categoryKey],
  );

  const isMultiSeries = seriesKeys.length > 1;
  const showLegendResolved = showLegend ?? isMultiSeries;
  const resolvedFillOpacity = linesOnly ? 0 : fillOpacity;

  return (
    <ChartContainer
      config={chartConfig}
      className={cn("mx-auto aspect-square max-h-[250px]", className)}
    >
      <RadarChart data={chartData}>
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <PolarAngleAxis dataKey={categoryKey} />
        <PolarGrid
          gridType={
            gridType === "circle" || gridType === "circle-fill"
              ? "circle"
              : "polygon"
          }
          className={cn(gridType === "circle-fill" && "fill-muted")}
        />
        {showLegendResolved && <ChartLegend content={<ChartLegendContent />} />}

        {seriesKeys.map((key) => (
          <Radar
            key={key}
            dataKey={key}
            fill={`var(--color-${key})`}
            fillOpacity={resolvedFillOpacity}
            stroke={`var(--color-${key})`}
            dot={
              showDots
                ? {
                    r: 4,
                    fillOpacity: 1,
                  }
                : false
            }
          />
        ))}
      </RadarChart>
    </ChartContainer>
  );
}
