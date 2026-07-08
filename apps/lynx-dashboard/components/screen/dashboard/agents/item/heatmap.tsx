"use client";
import {
  WeekdayHeatmap,
  WeekdayHeatmapBlock,
  WeekdayHeatmapBody,
  WeekdayHeatmapFooter,
  WeekdayHeatmapLegend,
  WeekdayHeatmapStat,
} from "@repo/ui/components/heatmap/weekday-heatmap";
import { format } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { useEffect, useRef, useState } from "react";

interface WeekdayHourlyActivity {
  weekday: number; // 0~6 (일~토)
  hour: number; // 0~23
  value: number;
}

const getBaseIssueCount = (weekday: number, hour: number) => {
  const isWeekend = weekday === 0 || weekday === 6;
  const isBusinessHour = hour >= 9 && hour <= 18;
  const isPeakHour = hour >= 10 && hour <= 16;
  const isLunchHour = hour === 12;

  if (isWeekend) {
    if (hour >= 10 && hour <= 17) return 5 + Math.floor(Math.random() * 6);
    if (hour >= 18 && hour <= 22) return 2 + Math.floor(Math.random() * 4);
    return Math.floor(Math.random() * 3);
  }

  if (isPeakHour) {
    const peakBoost = weekday === 3 || weekday === 4 ? 8 : 4;
    return 24 + peakBoost + Math.floor(Math.random() * 13);
  }

  if (isLunchHour) {
    return 18 + Math.floor(Math.random() * 8);
  }

  if (isBusinessHour) {
    return 12 + Math.floor(Math.random() * 12);
  }

  if (hour >= 19 && hour <= 22) {
    return 5 + Math.floor(Math.random() * 8);
  }

  return Math.floor(Math.random() * 4);
};

export const data: WeekdayHourlyActivity[] = Array.from(
  { length: 7 * 24 },
  (_, index) => {
    const weekday = Math.floor(index / 24);
    const hour = index % 24;

    return {
      weekday,
      hour,
      value: getBaseIssueCount(weekday, hour),
    };
  },
);

const avgIssue =
  Math.round((data.reduce((sum, a) => sum + a.value, 0) / data.length) * 10) /
  10;

function getAvgByHour(activities: WeekdayHourlyActivity[]): number[] {
  const sums = Array<number>(24).fill(0);
  const counts = Array<number>(24).fill(0);

  activities.forEach((a) => {
    sums[a.hour] += a.value;
    counts[a.hour] += 1;
  });

  return sums.map((sum, i) => (counts[i] ? sum / counts[i] : 0));
}

function getAvgByWeekday(activities: WeekdayHourlyActivity[]): number[] {
  const sums = Array<number>(7).fill(0);
  const counts = Array<number>(7).fill(0);

  activities.forEach((a) => {
    sums[a.weekday] += a.value;
    counts[a.weekday] += 1;
  });

  return sums.map((sum, i) => (counts[i] ? sum / counts[i] : 0));
}

const WEEKDAY_NAMES = Array.from({ length: 7 }, (_, i) =>
  format(new Date(2000, 0, 2 + i), "EEEE"),
);

/** 자식 콘텐츠가 컨테이너보다 크면 비율 유지하며 축소, 작으면 원본 크기 유지 */
function ScaleToFit({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [naturalHeight, setNaturalHeight] = useState<number | undefined>();

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const naturalWidth = inner.scrollWidth;
    setNaturalHeight(inner.scrollHeight);

    const observer = new ResizeObserver(([entry]) => {
      const outerWidth = entry?.contentRect.width ?? naturalWidth;
      setScale(Math.min(1, outerWidth / naturalWidth));
    });

    observer.observe(outer);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={outerRef} className={className}>
      <div
        style={{
          height: naturalHeight ? naturalHeight * scale : undefined,
          overflow: "hidden",
        }}
      >
        <div
          ref={innerRef}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: "max-content",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default function DashboardAgentItemHeatmap() {
  return (
    <div className="col-start-1 col-end-3 row-start-1 row-end-3 bg-background rounded-md p-5">
      <div>
        <h2 className="font-bold">이번 주 에이전트 이슈 추이</h2>
        <p className="text-foreground/50">
          시간별로 에이전트가 발생시킨 이슈를 측정합니다.
        </p>
      </div>
      <ScaleToFit>
        <TooltipProvider delayDuration={0}>
          <WeekdayHeatmap
            data={data}
            extraRow={{ label: "Avg", compute: getAvgByHour }}
            extraColumn={{ label: "Avg", compute: getAvgByWeekday }}
            colors={{ scale: "var(--color-destructive)" }}
          >
            <WeekdayHeatmapBody
              renderExtraRow={({ activity }) => (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <WeekdayHeatmapBlock activity={activity} extra="row" />
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="pointer-events-none text-xs"
                    sideOffset={6}
                  >
                    <p className="font-medium">
                      Avg {String(activity.hour).padStart(2, "0")}:00
                    </p>
                    <p className="text-muted-foreground">
                      avg. {activity.value.toFixed(1)}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
              renderExtraColumn={({ activity }) => (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <WeekdayHeatmapBlock activity={activity} extra="column" />
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="pointer-events-none text-xs"
                    sideOffset={6}
                  >
                    <p className="font-medium">
                      {WEEKDAY_NAMES[activity.weekday]} Avg
                    </p>
                    <p className="text-muted-foreground">
                      avg. {activity.value.toFixed(1)}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
            >
              {({ activity }) => (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <WeekdayHeatmapBlock activity={activity} />
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="pointer-events-none text-xs"
                    sideOffset={6}
                  >
                    <p className="font-medium">
                      {WEEKDAY_NAMES[activity.weekday]}{" "}
                      {`${String(activity.hour).padStart(2, "0")}:00`}
                    </p>
                    <p className="text-muted-foreground">
                      {activity.value.toFixed(1)}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
            </WeekdayHeatmapBody>
            <WeekdayHeatmapFooter>
              <WeekdayHeatmapStat>
                {() => (
                  <div className="text-muted-foreground tabular-nums">
                    Average Issue Count: {avgIssue.toFixed(1)} / h
                  </div>
                )}
              </WeekdayHeatmapStat>
              <WeekdayHeatmapLegend />
            </WeekdayHeatmapFooter>
          </WeekdayHeatmap>
        </TooltipProvider>
      </ScaleToFit>
    </div>
  );
}
