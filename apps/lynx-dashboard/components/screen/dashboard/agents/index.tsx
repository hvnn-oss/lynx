"use client";

import type {
  DashboardAgentScope,
  DashboardAgentsResponseDto,
} from "@repo/dto";
import {
  DashboardListPanel,
  DashboardListRow,
  DashboardMetricCard,
  DashboardMetricGrid,
  DashboardPageHeader,
} from "@repo/ui/components/dashboard/panel";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import {
  ActualDataBarChart,
  ActualDataPageLoading,
  ActualDataPageMessage,
} from "@/components/screen/dashboard/actual-data-page";
import { useDashboardAgents } from "@/hooks/use-dashboard-operational-pages";

const PAGE_KEY: Record<
  DashboardAgentScope,
  "overview" | "active" | "inactive"
> = {
  ALL: "overview",
  ACTIVE: "active",
  INACTIVE: "inactive",
};

export function DashboardAgentsScreen({
  scope,
}: {
  scope: DashboardAgentScope;
}) {
  const t = useTranslations("agentsPage");
  const pageKey = PAGE_KEY[scope];
  const { data, hasWorkspace, isPending, isError, refetch } =
    useDashboardAgents(scope);
  const pageTitle = t(`pages.${pageKey}.title`);
  const pageDescription = t(`pages.${pageKey}.description`);

  if (isPending) return <ActualDataPageLoading />;
  if (isError) {
    return (
      <ActualDataPageMessage
        title={t("error.title")}
        description={t("error.description")}
        pageTitle={pageTitle}
        pageDescription={pageDescription}
        action={t("error.action")}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }
  if (!hasWorkspace || !data) {
    return (
      <ActualDataPageMessage
        title={t("empty.workspaceTitle")}
        description={t("empty.workspaceDescription")}
        pageTitle={pageTitle}
        pageDescription={pageDescription}
      />
    );
  }

  return (
    <div className="space-y-8 p-20">
      <DashboardPageHeader title={pageTitle} description={pageDescription} />
      <AgentMetrics data={data} />
      <section className="grid gap-8 xl:grid-cols-[1fr_1.2fr]">
        <AgentList data={data} />
        <ActualDataBarChart
          title={t("volume.title")}
          description={t("volume.description", {
            hours: data.activeWithinHours,
          })}
          emptyText={t("volume.empty")}
          colorClassName={scope === "INACTIVE" ? "bg-slate-400" : "bg-blue-500"}
          items={data.runVolume.map((agent) => ({
            key: agent.agentId,
            label: agent.agentName,
            value: agent.count,
          }))}
        />
      </section>
    </div>
  );
}

function AgentMetrics({ data }: { data: DashboardAgentsResponseDto }) {
  const t = useTranslations("agentsPage.metrics");

  return (
    <DashboardMetricGrid>
      <DashboardMetricCard
        label={t("agents.label")}
        value={String(data.metrics.agentCount)}
        description={t("agents.description")}
      />
      <DashboardMetricCard
        label={t("active.label")}
        value={String(data.metrics.activeCount)}
        description={t("active.description", {
          hours: data.activeWithinHours,
        })}
        tone="good"
      />
      <DashboardMetricCard
        label={t("inactive.label")}
        value={String(data.metrics.inactiveCount)}
        description={t("inactive.description", {
          hours: data.activeWithinHours,
        })}
      />
      <DashboardMetricCard
        label={t("running.label")}
        value={String(data.metrics.runningRunCount)}
        description={t("running.description")}
      />
      <DashboardMetricCard
        label={t("failed.label")}
        value={String(data.metrics.failedRunCount)}
        description={t("failed.description")}
        tone={data.metrics.failedRunCount > 0 ? "bad" : "neutral"}
      />
    </DashboardMetricGrid>
  );
}

function AgentList({ data }: { data: DashboardAgentsResponseDto }) {
  const t = useTranslations("agentsPage.list");
  const format = useFormatter();

  return (
    <DashboardListPanel empty={data.agents.length === 0} emptyText={t("empty")}>
      <h2 className="px-2 pb-2 text-sm font-semibold">{t("title")}</h2>
      {data.agents.map((agent) => (
        <Link href={`/dashboard/agents/${agent.id}`} key={agent.id}>
          <DashboardListRow
            title={agent.name}
            description={t("description", {
              model: agent.defaultModel,
              runs: agent.recentRunCount,
              lastRunAt: agent.lastRunAt
                ? format.dateTime(new Date(agent.lastRunAt), {
                    dateStyle: "short",
                    timeStyle: "short",
                  })
                : t("never"),
              cost: format.number(agent.recentCost, {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 4,
              }),
            })}
            value={t(`status.${agent.status}`)}
            tone={
              agent.failedRunCount > 0
                ? "bad"
                : agent.status === "ACTIVE"
                  ? "good"
                  : "neutral"
            }
          />
        </Link>
      ))}
    </DashboardListPanel>
  );
}
