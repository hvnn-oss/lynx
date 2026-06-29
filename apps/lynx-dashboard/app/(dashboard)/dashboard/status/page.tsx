import { getTranslations } from "next-intl/server";
import { DashboardPageHeader } from "@repo/ui/components/dashboard/panel";
import { AgentStatus } from "@/components/dashboard/status/agent-status";
import { ModelStatus } from "@/components/dashboard/status/model-status";
import { RecentOutages } from "@/components/dashboard/status/recent-outages";
import { SloStatus } from "@/components/dashboard/status/slo-status";
import { ToolStatus } from "@/components/dashboard/status/tool-status";
import { UsePageInfo } from "@/components/util/set-pageinfo";

export default async function StatusPage() {
  const t = await getTranslations("dashboard.pages.status");
  const breadcrumbT = await getTranslations("dashboard.breadcrumbs");

  return (
    <main className="space-y-6 p-6">
      <UsePageInfo
        breadcrumbs={[
          { title: breadcrumbT("dashboard"), url: "/dashboard" },
          { title: t("breadcrumb"), url: "/dashboard/status" },
        ]}
      />

      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          description={t("description")}
          title={t("title")}
        />

        <div className="flex flex-col">
          <h2 className="mb-3 text-lg font-semibold">
            {t("sections.agentStatus")}
          </h2>
          <AgentStatus />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col lg:col-span-2">
            <h2 className="mb-3 text-lg font-semibold">
              {t("sections.recentOutages")}
            </h2>
            <RecentOutages />
          </div>
          <div className="flex flex-col">
            <h2 className="mb-3 text-lg font-semibold">{t("sections.slo")}</h2>
            <SloStatus />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col">
            <h2 className="mb-3 text-lg font-semibold">
              {t("sections.modelStatus")}
            </h2>
            <ModelStatus />
          </div>
          <div className="flex flex-col">
            <h2 className="mb-3 text-lg font-semibold">
              {t("sections.toolStatus")}
            </h2>
            <ToolStatus />
          </div>
        </div>
      </div>
    </main>
  );
}
