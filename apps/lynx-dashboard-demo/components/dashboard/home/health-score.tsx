import type { DashboardHomeMetricsDto } from "@repo/dto";
import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Separator } from "@repo/ui/components/ui/separator";
import { useTranslations } from "next-intl";
import { ListSkeleton } from "../shared/skeletons";
import {
  DashboardMoreRow,
  getCappedItems,
} from "@/components/dashboard/shared/dashboard-panels";

type HealthScoreItem = DashboardHomeMetricsDto["healthScores"][number];

interface HealthScoreProps {
  data?: HealthScoreItem[];
  isLoading?: boolean;
}

const HEALTH_SCORE_LIMIT = 8;

export function HealthScore({ data, isLoading = false }: HealthScoreProps) {
  const t = useTranslations("dashboard.home.agents");
  const sharedT = useTranslations("dashboard.shared");

  if (isLoading || !data) return <ListSkeleton className="h-full" rows={5} />;

  const { items, hiddenCount } = getCappedItems(data, HEALTH_SCORE_LIMIT);

  return (
    <div className="h-full rounded-lg border border-border/60 bg-background p-4">
      <div className="space-y-1">
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <>
            {items.map((agent, index) => (
              <div key={agent.agentId}>
                <div className="flex items-center justify-between gap-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg text-xs">
                        {getInitials(agent.agentName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {agent.agentName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatStatus(agent.status, t)}
                      </p>
                    </div>
                  </div>
                  <div className="flex min-w-20 flex-col items-end gap-1">
                    <span className="text-sm font-semibold">{agent.score}</span>
                    <span
                      className={`h-1.5 w-full rounded-full ${getScoreBarClass(agent.status)}`}
                    />
                  </div>
                </div>
                {index < items.length - 1 ? <Separator /> : null}
              </div>
            ))}
            <DashboardMoreRow
              hiddenCount={hiddenCount}
              label={sharedT("remainingItems", {
                count: hiddenCount,
                itemName: "에이전트",
              })}
            />
          </>
        )}
      </div>
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatStatus(
  status: HealthScoreItem["status"],
  t: ReturnType<typeof useTranslations<"dashboard.home.agents">>,
) {
  if (status === "HEALTHY") return t("healthy");
  if (status === "WARNING") return t("warning");
  return t("critical");
}

function getScoreBarClass(status: HealthScoreItem["status"]) {
  if (status === "HEALTHY") return "bg-emerald-500";
  if (status === "WARNING") return "bg-amber-500";
  return "bg-rose-500";
}
