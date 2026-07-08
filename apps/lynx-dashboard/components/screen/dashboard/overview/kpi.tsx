import { KpiCard } from "@/components/screen/dashboard/overview/kpi-card";
import { useTranslations } from "next-intl";

export function DashboardOverviewKPICard() {
  const t = useTranslations("dashboard.overview.kpi");
  return (
    <div className="grid grid-cols-4 p-3 gap-3">
      <KpiCard
        title={t("critical.title")}
        subtitle={t("critical.subtitle")}
        figure={21}
        unit={t("critical.unit")}
        href="/issues/critical"
        isRisky
      />
      <KpiCard
        title={t("warning.title")}
        subtitle={t("warning.subtitle")}
        figure={42}
        unit={t("warning.unit")}
        href="/issues/critical"
      />
      <KpiCard
        title={t("firewall_blocked.title")}
        subtitle={t("firewall_blocked.subtitle")}
        figure={52}
        unit={t("firewall_blocked.unit")}
        href="/issues/critical"
      />
      <KpiCard
        title={t("normal_throughout_rate.title")}
        subtitle={t("normal_throughout_rate.subtitle")}
        figure={96.3}
        unit={t("normal_throughout_rate.unit")}
        href="/issues/critical"
        ticker="3.1%p"
        tickerUp={false}
      />
    </div>
  );
}
