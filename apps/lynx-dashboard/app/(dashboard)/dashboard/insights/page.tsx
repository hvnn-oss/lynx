import { getTranslations } from "next-intl/server";
import { DashboardPageHeader } from "@repo/ui/components/dashboard/panel";
import { InsightList } from "@/components/dashboard/insights/insight-list";
import { UsePageInfo } from "@/components/util/set-pageinfo";

export default async function InsightsPage() {
  const t = await getTranslations("dashboard.pages.insights");
  const breadcrumbT = await getTranslations("dashboard.breadcrumbs");

  return (
    <main className="space-y-6 p-6">
      <UsePageInfo
        breadcrumbs={[
          { title: breadcrumbT("dashboard"), url: "/dashboard" },
          { title: t("breadcrumb"), url: "/dashboard/insights" },
        ]}
      />

      <div className="flex flex-col gap-6">
        <DashboardPageHeader
          description={t("description")}
          title={t("title")}
        />

        <div className="flex flex-col">
          <h2 className="mb-3 text-lg font-semibold">{t("sections.list")}</h2>
          <InsightList />
        </div>
      </div>
    </main>
  );
}
