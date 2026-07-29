"use client";

import type { DashboardCostResponseDto } from "@repo/dto";
import {
  DashboardListPanel,
  DashboardListRow,
  DashboardMetricCard,
  DashboardMetricGrid,
  DashboardPageHeader,
  DashboardPanel,
} from "@repo/ui/components/dashboard/panel";
import { useFormatter, useTranslations } from "next-intl";
import {
  ActualDataBarChart,
  ActualDataPageLoading,
  ActualDataPageMessage,
} from "@/components/screen/dashboard/actual-data-page";
import { useDashboardCost } from "@/hooks/use-dashboard-operational-pages";

export function DashboardCostScreen() {
  const t = useTranslations("costPage");
  const format = useFormatter();
  const { data, hasWorkspace, isPending, isError, refetch } =
    useDashboardCost();

  if (isPending) return <ActualDataPageLoading />;
  if (isError) {
    return (
      <ActualDataPageMessage
        title={t("error.title")}
        description={t("error.description")}
        pageTitle={t("title")}
        pageDescription={t("description")}
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
        pageTitle={t("title")}
        pageDescription={t("description")}
      />
    );
  }

  return (
    <div className="space-y-8 p-20">
      <DashboardPageHeader title={t("title")} description={t("description")} />
      <CostMetrics data={data} />
      <PricingCoverage data={data} />
      <section className="grid gap-8 xl:grid-cols-[1.2fr_1fr]">
        <ActualDataBarChart
          title={t("trend.title")}
          description={t("trend.description")}
          emptyText={t("trend.empty")}
          items={data.dailyCost.map((bucket) => ({
            key: bucket.date,
            label: format.dateTime(new Date(`${bucket.date}T00:00:00Z`), {
              month: "numeric",
              day: "numeric",
            }),
            value: bucket.cost,
          }))}
          formatValue={(value) => formatCurrency(format, value, data.currency)}
        />
        <TopAgentCosts data={data} />
      </section>
    </div>
  );
}

function CostMetrics({ data }: { data: DashboardCostResponseDto }) {
  const t = useTranslations("costPage.metrics");
  const format = useFormatter();
  const currency = (value: number) =>
    formatCurrency(format, value, data.currency);

  return (
    <DashboardMetricGrid>
      <DashboardMetricCard
        label={t("today.label")}
        value={currency(data.metrics.today)}
        description={t("today.description")}
      />
      <DashboardMetricCard
        label={t("week.label")}
        value={currency(data.metrics.thisWeek)}
        description={t("week.description")}
      />
      <DashboardMetricCard
        label={t("month.label")}
        value={currency(data.metrics.thisMonth)}
        description={t("month.description")}
      />
      <DashboardMetricCard
        label={t("average.label")}
        value={currency(data.metrics.averagePerRunThisMonth)}
        description={t("average.description")}
      />
      <DashboardMetricCard
        label={t("tokens.label")}
        value={format.number(data.metrics.totalTokensThisMonth)}
        description={t("tokens.description")}
      />
    </DashboardMetricGrid>
  );
}

function PricingCoverage({ data }: { data: DashboardCostResponseDto }) {
  const t = useTranslations("costPage.pricing");
  const format = useFormatter();
  const coverage = data.pricingCoverage;
  const description =
    coverage.totalLlmCalls === 0
      ? t("noCalls")
      : coverage.unpricedLlmCalls > 0
        ? t("incomplete")
        : t("complete");

  return (
    <DashboardPanel className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <span className="font-semibold tabular-nums">
          {t("coverage", {
            percentage: format.number(coverage.percentage, {
              maximumFractionDigits: 1,
            }),
          })}
        </span>
        <span className="text-muted-foreground">
          {t("counts", {
            priced: format.number(coverage.pricedLlmCalls),
            unpriced: format.number(coverage.unpricedLlmCalls),
            estimated: format.number(coverage.estimatedLlmCalls),
          })}
        </span>
        <span className="font-mono text-muted-foreground">
          {t("catalog", { version: coverage.catalogVersion })}
        </span>
      </div>
    </DashboardPanel>
  );
}

function TopAgentCosts({ data }: { data: DashboardCostResponseDto }) {
  const t = useTranslations("costPage.agents");
  const format = useFormatter();

  return (
    <DashboardListPanel
      empty={data.topAgents.length === 0}
      emptyText={t("empty")}
    >
      <h2 className="px-2 pb-2 text-sm font-semibold">{t("title")}</h2>
      {data.topAgents.map((agent) => (
        <DashboardListRow
          key={agent.agentId}
          title={agent.agentName}
          description={t("description", {
            runs: agent.runCount,
            tokens: format.number(agent.totalTokens),
          })}
          value={formatCurrency(format, agent.cost, data.currency)}
        />
      ))}
    </DashboardListPanel>
  );
}

type DashboardFormatter = ReturnType<typeof useFormatter>;

/** 작은 LLM 호출 비용도 0달러로 보이지 않도록 최대 6자리까지 표시합니다. */
function formatCurrency(
  format: DashboardFormatter,
  value: number,
  currency: string,
): string {
  const minimumVisibleCost = 0.000001;
  const options = {
    style: "currency" as const,
    currency,
    maximumFractionDigits: 6,
  };
  if (value > 0 && value < minimumVisibleCost) {
    return `<${format.number(minimumVisibleCost, options)}`;
  }
  return format.number(value, options);
}
