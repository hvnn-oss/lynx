import type {
  DashboardOverviewResponseDto,
  RunListResponseDto,
} from "@repo/dto";

const OVERVIEW_DAY_COUNT = 7;

export type OverviewRun = RunListResponseDto["items"][number];

export interface OverviewSummary {
  runCount: number;
  terminalRunCount: number;
  failedRunCount: number;
  failureRate: number;
  p95LatencyMs: number | null;
  totalCost: number;
  riskEventCount: number;
  isRunListCapped: boolean;
}

export interface OverviewTrendBucket extends Record<string, string | number> {
  date: string;
  runs: number;
  failures: number;
  failureRate: number;
}

export interface AgentHealthSummary {
  id: string;
  name: string;
  runCount: number;
  failureCount: number;
  failureRate: number;
  p95LatencyMs: number | null;
  totalCost: number;
  lastRunAt: string;
  state: "healthy" | "degraded";
}

export function buildOverviewSummary(
  overview: DashboardOverviewResponseDto,
  runs: RunListResponseDto,
): OverviewSummary {
  const terminalRuns = runs.items.filter((run) => run.status !== "RUNNING");
  const failedRunCount = terminalRuns.filter(
    (run) => run.status === "FAILED",
  ).length;

  return {
    runCount: runs.items.length,
    terminalRunCount: terminalRuns.length,
    failedRunCount,
    failureRate: calculatePercentage(failedRunCount, terminalRuns.length),
    p95LatencyMs: calculateP95Latency(runs.items),
    totalCost: runs.items.reduce((sum, run) => sum + run.usage.cost, 0),
    riskEventCount: overview.kpis.firewallBlocked,
    isRunListCapped: runs.nextCursor !== null,
  };
}

export function buildRunTrend(runs: OverviewRun[]): OverviewTrendBucket[] {
  const buckets = createDailyBuckets();
  const byDate = new Map(buckets.map((bucket) => [bucket.date, bucket]));

  for (const run of runs) {
    const date = toLocalDateKey(new Date(run.startedAt));
    const bucket = byDate.get(date);
    if (!bucket) continue;
    bucket.runs += 1;
    if (run.status === "FAILED") bucket.failures += 1;
  }

  return buckets.map((bucket) => ({
    ...bucket,
    failureRate: calculatePercentage(bucket.failures, bucket.runs),
  }));
}

export function buildAgentHealth(runs: OverviewRun[]): AgentHealthSummary[] {
  const agents = new Map<
    string,
    {
      id: string;
      name: string;
      runs: OverviewRun[];
    }
  >();

  for (const run of runs) {
    const current = agents.get(run.agent.id);
    if (current) {
      current.runs.push(run);
      continue;
    }
    agents.set(run.agent.id, {
      id: run.agent.id,
      name: run.agent.name,
      runs: [run],
    });
  }

  return [...agents.values()]
    .map(({ id, name, runs: agentRuns }) => {
      const failureCount = agentRuns.filter(
        (run) => run.status === "FAILED",
      ).length;
      return {
        id,
        name,
        runCount: agentRuns.length,
        failureCount,
        failureRate: calculatePercentage(failureCount, agentRuns.length),
        p95LatencyMs: calculateP95Latency(agentRuns),
        totalCost: agentRuns.reduce((sum, run) => sum + run.usage.cost, 0),
        lastRunAt: agentRuns.reduce(
          (latest, run) => (run.startedAt > latest ? run.startedAt : latest),
          agentRuns[0]!.startedAt,
        ),
        state: failureCount > 0 ? ("degraded" as const) : ("healthy" as const),
      };
    })
    .sort(
      (left, right) =>
        right.failureCount - left.failureCount ||
        right.runCount - left.runCount ||
        right.lastRunAt.localeCompare(left.lastRunAt),
    );
}

export function formatLatency(milliseconds: number | null): string {
  if (milliseconds === null) return "—";
  if (milliseconds < 1_000) return `${Math.round(milliseconds)}ms`;
  return `${(milliseconds / 1_000).toFixed(1)}s`;
}

export function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function calculateP95Latency(runs: OverviewRun[]): number | null {
  const durations = runs
    .flatMap((run) =>
      run.endedAt
        ? [new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime()]
        : [],
    )
    .filter((duration) => Number.isFinite(duration) && duration >= 0)
    .sort((left, right) => left - right);

  if (durations.length === 0) return null;
  const index = Math.max(0, Math.ceil(durations.length * 0.95) - 1);
  return durations[index] ?? null;
}

function calculatePercentage(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 1_000) / 10;
}

function createDailyBuckets(): OverviewTrendBucket[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: OVERVIEW_DAY_COUNT }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (OVERVIEW_DAY_COUNT - index - 1));
    return {
      date: toLocalDateKey(date),
      runs: 0,
      failures: 0,
      failureRate: 0,
    };
  });
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
