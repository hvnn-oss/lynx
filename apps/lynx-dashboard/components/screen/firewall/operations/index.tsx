import {
  DashboardListPanel,
  DashboardPageHeader,
  DashboardPanel,
} from "@repo/ui/components/dashboard/panel";
import { Button } from "@repo/ui/components/ui/button";
import { Play, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  getPolicy,
  getPolicySimulationResult,
  listBlockedEvents,
  listPolicies,
  listPolicyCoverage,
  listRiskTools,
} from "@/lib/operations/service";
import {
  getSeverityClass,
  getStateClass,
  OperationsBadge,
} from "@/components/ui/operations/status-badge";
import {
  OperationsDetailSection,
  OperationsInfoList,
} from "@/components/ui/operations/detail-section";
import { formatDateTime } from "@/components/ui/operations/format";
import { OperationsKpiCard } from "@/components/ui/operations/kpi-card";

export function FirewallOverviewScreen() {
  const t = useTranslations("firewall");
  const policies = listPolicies();

  return (
    <div className="space-y-5">
      <DashboardPageHeader title={t("overview.title")} description={t("overview.subtitle")} />
      <section className="grid gap-3 md:grid-cols-4">
        <OperationsKpiCard label={t("metrics.enabled")} value={String(policies.filter((policy) => policy.enabled).length)} description={t("metrics.enabledHint")} tone="good" />
        <OperationsKpiCard label={t("metrics.block")} value={String(policies.filter((policy) => policy.action === "block").length)} description={t("metrics.blockHint")} tone="bad" />
        <OperationsKpiCard label={t("metrics.triggers")} value={String(policies.reduce((sum, policy) => sum + policy.triggerCount, 0))} description={t("metrics.triggersHint")} tone="warning" />
        <OperationsKpiCard label={t("metrics.agents")} value={String(new Set(policies.flatMap((policy) => policy.connectedAgents)).size)} description={t("metrics.agentsHint")} />
      </section>
      <PolicyList policies={policies} />
    </div>
  );
}

export function BlockedEventsScreen() {
  const t = useTranslations("firewall.blockedEvents");
  const severity = useTranslations("severity");
  const events = listBlockedEvents();

  return (
    <div className="space-y-5">
      <DashboardPageHeader title={t("title")} description={t("subtitle")} />
      <DashboardListPanel empty={events.length === 0} emptyText={t("empty")}>
        {events.map((event) => (
          <div className="rounded-md px-3 py-3 hover:bg-muted/30" key={event.id}>
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">{event.toolName}</p>
                  <OperationsBadge className={getSeverityClass(event.severity)}>{severity(event.severity)}</OperationsBadge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{event.reason}</p>
                <p className="mt-2 text-xs text-muted-foreground">{event.agentName} / {event.policyName}</p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p className="font-bold text-foreground">{event.sessionId}</p>
                <p className="mt-1">{formatDateTime(event.occurredAt)}</p>
              </div>
            </div>
          </div>
        ))}
      </DashboardListPanel>
    </div>
  );
}

export function PolicyCoverageScreen() {
  const t = useTranslations("firewall.coverage");
  const rows = listPolicyCoverage();

  return (
    <div className="space-y-5">
      <DashboardPageHeader title={t("title")} description={t("subtitle")} />
      <DashboardListPanel empty={rows.length === 0} emptyText={t("empty")}>
        {rows.map((row) => (
          <div className="rounded-md px-3 py-3 hover:bg-muted/30" key={`${row.agentName}-${row.environment}`}>
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">{row.agentName}</p>
                  <OperationsBadge className={getStateClass(row.environment)}>{row.environment}</OperationsBadge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{row.missingRecommendedPolicies.join(", ") || t("noneMissing")}</p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-right text-xs text-muted-foreground">
                <Metric label={t("enabled")} value={String(row.enabledPolicies)} />
                <Metric label={t("disabled")} value={String(row.disabledPolicies)} />
                <Metric label={t("lastChecked")} value={formatDateTime(row.lastCheckedAt)} />
              </div>
            </div>
          </div>
        ))}
      </DashboardListPanel>
    </div>
  );
}

export function RiskToolsScreen() {
  const t = useTranslations("firewall.riskTools");
  const severity = useTranslations("severity");
  const tools = listRiskTools();

  return (
    <div className="space-y-5">
      <DashboardPageHeader title={t("title")} description={t("subtitle")} />
      <DashboardListPanel empty={tools.length === 0} emptyText={t("empty")}>
        {tools.map((tool) => (
          <div className="rounded-md px-3 py-3 hover:bg-muted/30" key={tool.name}>
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">{tool.name}</p>
                  <OperationsBadge className={getSeverityClass(tool.riskLevel)}>{severity(tool.riskLevel)}</OperationsBadge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{tool.category}</p>
                <p className="mt-2 text-xs text-muted-foreground">{tool.connectedPolicies.join(", ")}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-right text-xs text-muted-foreground">
                <Metric label={t("blocked")} value={String(tool.blockedCount)} />
                <Metric label={t("lastBlocked")} value={formatDateTime(tool.lastBlockedAt)} />
              </div>
            </div>
          </div>
        ))}
      </DashboardListPanel>
    </div>
  );
}

export function PolicySimulationScreen() {
  const t = useTranslations("firewall.simulation");
  const action = useTranslations("action");
  const severity = useTranslations("severity");
  const result = getPolicySimulationResult();

  return (
    <div className="space-y-5">
      <DashboardPageHeader title={t("title")} description={t("subtitle")} />
      <section className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <DashboardPanel>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold">{t("inputTitle")}</h2>
            <OperationsBadge className="border-slate-200 bg-slate-50 text-slate-700">JSON</OperationsBadge>
          </div>
          <textarea className="mt-4 min-h-72 w-full rounded-md border border-border bg-background p-3 font-mono text-sm" defaultValue={'{ "tool": "refundInvoice", "amount": 12800 }'} />
          <Button className="mt-3" variant="outline">
            <Play data-icon="inline-start" />
            {t("runMock")}
          </Button>
        </DashboardPanel>
        <DashboardPanel>
          <h2 className="text-sm font-bold">{t("resultTitle")}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ResultBox label={t("decision")} value={action(result.action)} tone={getStateClass(result.action)} />
            <ResultBox label="severity" value={severity(result.severity)} tone={getSeverityClass(result.severity)} />
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">{result.reason}</p>
          <div className="mt-4 rounded-md border border-border/70 bg-muted/20 p-3">
            <p className="text-xs font-bold uppercase tracking-normal text-muted-foreground">{t("matchedPolicies")}</p>
            <p className="mt-2 text-sm font-bold">{result.matchedPolicies.join(", ")}</p>
          </div>
        </DashboardPanel>
      </section>
    </div>
  );
}

export function PolicyDetailScreen({ policyId }: { policyId: string }) {
  const t = useTranslations("firewall.detail");
  const severity = useTranslations("severity");
  const action = useTranslations("action");
  const policy = getPolicy(policyId);

  return (
    <div className="space-y-5">
      <DashboardPageHeader title={policy.name} description={policy.description} badge={<OperationsBadge className={getSeverityClass(policy.severity)}>{severity(policy.severity)}</OperationsBadge>} />
      <section className="grid gap-3 md:grid-cols-4">
        <OperationsKpiCard label={t("action")} value={action(policy.action)} description={t("actionHint")} tone={policy.action === "block" ? "bad" : "warning"} />
        <OperationsKpiCard label={t("enabled")} value={policy.enabled ? t("enabledYes") : t("enabledNo")} description={t("enabledHint")} tone={policy.enabled ? "good" : "neutral"} />
        <OperationsKpiCard label={t("triggers")} value={String(policy.triggerCount)} description={t("triggersHint")} tone="warning" />
        <OperationsKpiCard label={t("agents")} value={String(policy.connectedAgents.length)} description={t("agentsHint")} />
      </section>
      <OperationsDetailSection title={t("condition")}>
        <OperationsInfoList
          items={[
            { label: t("conditionType"), value: policy.conditionType },
            { label: t("conditionValue"), value: policy.conditionValue },
            { label: t("targetAgents"), value: policy.connectedAgents.join(", ") },
            { label: t("lastTriggered"), value: formatDateTime(policy.lastTriggeredAt) },
          ]}
        />
      </OperationsDetailSection>
      <OperationsDetailSection title={t("runtime")}>
        <div className="flex gap-3 text-sm leading-6 text-muted-foreground">
          <ShieldCheck className="mt-1 size-4 shrink-0 text-emerald-600" />
          <p>{t("runtimeText")}</p>
        </div>
      </OperationsDetailSection>
    </div>
  );
}

function PolicyList({ policies }: { policies: ReturnType<typeof listPolicies> }) {
  const t = useTranslations("firewall");
  const severity = useTranslations("severity");
  const action = useTranslations("action");

  return (
    <DashboardListPanel empty={policies.length === 0} emptyText={t("empty")}>
      {policies.map((policy) => (
        <Link className="block rounded-md px-3 py-3 hover:bg-muted/30" href={`/firewall/policies/${policy.id}`} key={policy.id}>
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold">{policy.name}</p>
                <OperationsBadge className={getSeverityClass(policy.severity)}>{severity(policy.severity)}</OperationsBadge>
                <OperationsBadge className={getStateClass(policy.action)}>{action(policy.action)}</OperationsBadge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{policy.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">{policy.connectedAgents.join(", ")}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-right text-xs text-muted-foreground">
              <Metric label={t("fields.triggers")} value={String(policy.triggerCount)} />
              <Metric label={t("fields.lastTriggered")} value={formatDateTime(policy.lastTriggeredAt)} />
            </div>
          </div>
        </Link>
      ))}
    </DashboardListPanel>
  );
}

function ResultBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-background p-3">
      <p className="text-xs font-bold uppercase tracking-normal text-muted-foreground">{label}</p>
      <OperationsBadge className={`${tone} mt-2 font-bold`}>{value}</OperationsBadge>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p>{label}</p>
      <p className="mt-1 font-bold text-foreground">{value}</p>
    </div>
  );
}
