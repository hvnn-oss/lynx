import type { DashboardHomeMetricsDto } from "@repo/dto";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@repo/ui/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartSkeleton } from "../shared/skeletons";

type RunVolumeItem = DashboardHomeMetricsDto["runVolume"][number];

interface RunVolumeProps {
  data?: RunVolumeItem[];
  isLoading?: boolean;
}

const chartConfig = {
  count: {
    label: "Runs",
    color: "var(--chart-1, hsl(var(--primary)))",
  },
} satisfies ChartConfig;

export function RunVolume({ data, isLoading = false }: RunVolumeProps) {
  if (isLoading || !data) {
    return <ChartSkeleton className="h-full" height="h-48" />;
  }

  return (
    <div className="h-full rounded-xl border border-border/40 bg-card/30 p-5">
      <ChartContainer config={chartConfig} className="h-56 w-full">
        <BarChart data={data} margin={{ left: -18, right: 8, top: 8 }}>
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
          <Bar
            dataKey="count"
            fill="var(--color-count)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
