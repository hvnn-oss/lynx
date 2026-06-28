import type { DashboardHomeMetricsDto } from "@repo/dto";
import {
  Avatar,
  AvatarFallback,
} from "@repo/ui/components/ui/avatar";
import { Separator } from "@repo/ui/components/ui/separator";
import { ListSkeleton } from "../shared/skeletons";

type HealthScoreItem = DashboardHomeMetricsDto["healthScores"][number];

interface HealthScoreProps {
  data?: HealthScoreItem[];
  isLoading?: boolean;
}

export function HealthScore({ data, isLoading = false }: HealthScoreProps) {
  if (isLoading || !data) return <ListSkeleton className="h-full" rows={5} />;

  return (
    <div className="h-full rounded-xl border border-border/40 bg-card/30 p-5">
      <div className="space-y-1">
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            표시할 에이전트가 없습니다.
          </p>
        ) : (
          data.map((agent, index) => (
            <div key={agent.agentId}>
              <div className="flex items-center justify-between gap-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="size-9 rounded-lg">
                    <AvatarFallback className="rounded-lg text-xs">
                      {getInitials(agent.agentName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {agent.agentName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatStatus(agent.status)}
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
              {index < data.length - 1 ? <Separator /> : null}
            </div>
          ))
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

function formatStatus(status: HealthScoreItem["status"]) {
  if (status === "HEALTHY") return "Healthy";
  if (status === "WARNING") return "Warning";
  return "Critical";
}

function getScoreBarClass(status: HealthScoreItem["status"]) {
  if (status === "HEALTHY") return "bg-emerald-500";
  if (status === "WARNING") return "bg-amber-500";
  return "bg-rose-500";
}
