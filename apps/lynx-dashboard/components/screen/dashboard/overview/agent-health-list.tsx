import { cn } from "@/lib/utils";
import {
  DashboardListPanel,
  DashboardListRow,
  DashboardMoreRow,
  DashboardRowSeparator,
  DashboardSectionHeader,
  getCappedItems,
} from "@repo/ui/components/dashboard/panel";
import { buttonVariants } from "@repo/ui/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  formatCost,
  formatLatency,
  type AgentHealthSummary,
} from "./overview-model";

const AGENT_SUMMARY_LIMIT = 8;

export function AgentHealthList({ agents }: { agents: AgentHealthSummary[] }) {
  const t = useTranslations("dashboard.overview.agentHealth");
  const capped = getCappedItems(agents, AGENT_SUMMARY_LIMIT);

  return (
    <section className="space-y-3">
      <DashboardSectionHeader
        title={t("title")}
        description={t("description")}
        action={
          <Link
            href="/dashboard/agents/overview"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            {t("action")}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        }
      />
      <DashboardListPanel
        empty={capped.items.length === 0}
        emptyText={t("empty")}
        footer={
          <DashboardMoreRow
            hiddenCount={capped.hiddenCount}
            label={t("more", { count: capped.hiddenCount })}
          />
        }
      >
        {capped.items.map((agent, index) => (
          <div key={agent.id}>
            {index > 0 ? <DashboardRowSeparator /> : null}
            <Link href={`/dashboard/agents/${agent.id}`} className="block">
              <DashboardListRow
                title={agent.name}
                description={t("row.description", {
                  runs: agent.runCount,
                  latency: formatLatency(agent.p95LatencyMs),
                  cost: formatCost(agent.totalCost),
                })}
                value={`${agent.failureRate.toFixed(1)}%`}
                tone={agent.state === "degraded" ? "bad" : "good"}
                markerClassName={
                  agent.state === "degraded" ? "bg-rose-500" : "bg-emerald-500"
                }
              />
            </Link>
          </div>
        ))}
      </DashboardListPanel>
    </section>
  );
}
