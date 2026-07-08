import { getTranslations } from "next-intl/server";
import { DashboardPageHeader } from "@repo/ui/components/dashboard/panel";
import { EnvironmentUsage } from "@/components/dashboard/usage/environment-usage";
import { ModelUsage } from "@/components/dashboard/usage/model-usage";
import { ToolUsage } from "@/components/dashboard/usage/tool-usage";
import { TopAgents } from "@/components/dashboard/usage/top-agents";
import { UsageHeatmap } from "@/components/dashboard/usage/usage-heatmap";
import { UsePageInfo } from "@/components/util/set-pageinfo";

export default async function UsagePage() {
  const t = await getTranslations("dashboard.pages.usage");
  const breadcrumbT = await getTranslations("dashboard.breadcrumbs");

  return (
    <main className="space-y-6 p-6">
      <UsePageInfo
        breadcrumbs={[
          { title: breadcrumbT("dashboard"), url: "/dashboard" },
          { title: t("breadcrumb"), url: "/dashboard/usage" },
        ]}
      />

      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          description={t("description")}
          title={t("title")}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col">
            <h2 className="mb-3 text-lg font-semibold">
              {t("sections.topAgents")}
            </h2>
            <TopAgents />
          </div>
          <div className="flex flex-col">
            <h2 className="mb-3 text-lg font-semibold">
              {t("sections.environmentUsage")}
            </h2>
            <EnvironmentUsage />
          </div>
        </div>

        <div className="flex flex-col">
          <h2 className="mb-3 text-lg font-semibold">
            {t("sections.heatmap")}
          </h2>
          <UsageHeatmap />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col">
            <h2 className="mb-3 text-lg font-semibold">
              {t("sections.toolUsage")}
            </h2>
            <ToolUsage />
          </div>
          <div className="flex flex-col">
            <h2 className="mb-3 text-lg font-semibold">
              {t("sections.modelUsage")}
            </h2>
            <ModelUsage />
          </div>
        </div>
      </div>
    </main>
  );
}
