import type { DashboardHomeMetricsDto } from "@repo/dto";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@repo/ui/components/ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartSkeleton } from "../shared/skeletons";

type FailureTrendItem = DashboardHomeMetricsDto["failureTrend"][number];

interface FailureTrendProps {
  data?: FailureTrendItem[];
  isLoading?: boolean;
}

const chartConfig = {
  rate: {
    label: "Failure Rate",
    color: "var(--chart-2, hsl(var(--destructive)))",
  },
} satisfies ChartConfig;

export function FailureTrend({ data, isLoading = false }: FailureTrendProps) {
  if (isLoading || !data) {
    return <ChartSkeleton className="h-full" height="h-48" />;
  }

  return (
    <div className="h-full rounded-xl border border-border/40 bg-card/30 p-5">
      <ChartContainer config={chartConfig} className="h-56 w-full">
        <LineChart data={data} margin={{ left: -18, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="time"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
          />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={36} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            type="monotone"
            dataKey="rate"
            stroke="var(--color-rate)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
