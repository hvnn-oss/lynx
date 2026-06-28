import type { DashboardHomeMetricsDto } from "@repo/dto";
import {
  Avatar,
  AvatarFallback,
} from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { AlertTriangle } from "lucide-react";
import { ListSkeleton } from "../shared/skeletons";

type RecentIssue = DashboardHomeMetricsDto["recentIssues"][number];

interface RecentIssuesProps {
  data?: RecentIssue[];
  isLoading?: boolean;
}

export function RecentIssues({ data, isLoading = false }: RecentIssuesProps) {
  if (isLoading || !data) return <ListSkeleton className="w-full" rows={4} />;

  return (
    <div className="rounded-xl border border-border/40 bg-card/30 p-5">
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          최근 감지된 이슈가 없습니다.
        </p>
      ) : (
        <div className="space-y-1">
          {data.map((issue, index) => (
            <div key={issue.id}>
              <div className="flex items-center justify-between gap-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="size-9 rounded-lg">
                    <AvatarFallback
                      className={`rounded-lg ${getSeverityClass(issue.severity)}`}
                    >
                      <AlertTriangle className="size-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {issue.issueType}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {issue.agentName} · {formatTime(issue.timestamp)}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="xs">
                  보기
                </Button>
              </div>
              {index < data.length - 1 ? <Separator /> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getSeverityClass(severity: RecentIssue["severity"]) {
  return severity === "CRITICAL"
    ? "bg-rose-100 text-rose-700"
    : "bg-amber-100 text-amber-700";
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
