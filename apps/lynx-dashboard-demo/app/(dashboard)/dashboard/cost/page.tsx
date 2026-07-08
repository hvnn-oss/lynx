import { getTranslations } from "next-intl/server";
import { DashboardPageHeader } from "@repo/ui/components/dashboard/panel";
import { CostAnomaly } from "@/components/dashboard/cost/cost-anomaly";
import { CostBreakdown } from "@/components/dashboard/cost/cost-breakdown";
import { CostByAgent } from "@/components/dashboard/cost/cost-by-agent";
import { CostPerRun } from "@/components/dashboard/cost/cost-per-run";
import { TotalCost } from "@/components/dashboard/cost/total-cost";
import { UsePageInfo } from "@/components/util/set-pageinfo";

export default async function CostPage() {
  const t = await getTranslations("dashboard.pages.cost");
  const breadcrumbT = await getTranslations("dashboard.breadcrumbs");

  return (
    <main className="space-y-6 p-6">
      <UsePageInfo
        breadcrumbs={[
          { title: breadcrumbT("dashboard"), url: "/dashboard" },
          { title: t("breadcrumb"), url: "/dashboard/cost" },
        ]}
      />

      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          description={t("description")}
          title={t("title")}
        />

        <div className="flex flex-col">
          <h2 className="mb-3 text-lg font-semibold">{t("sections.total")}</h2>
          <TotalCost />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col">
            <h2 className="mb-3 text-lg font-semibold">
              {t("sections.breakdown")}
            </h2>
            <CostBreakdown />
          </div>
          <div className="flex flex-col">
            <h2 className="mb-3 text-lg font-semibold">
              {t("sections.byAgent")}
            </h2>
            <CostByAgent />
          </div>
          <div className="flex flex-col">
            <h2 className="mb-3 text-lg font-semibold">
              {t("sections.perRun")}
            </h2>
            <CostPerRun />
          </div>
        </div>

        <div className="flex flex-col">
          <h2 className="mb-3 text-lg font-semibold">
            {t("sections.anomaly")}
          </h2>
          <CostAnomaly />
        </div>
      </div>
    </main>
  );
}
