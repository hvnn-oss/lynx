import { PageInfo } from "@/components/page-info";
import { NoDataScreen } from "@/components/screen/no-data";
import { DashboardOverviewScreen } from "@/components/screen/dashboard/overview";
import { useTranslations } from "next-intl";

export default function DashboardOverviewPage() {
  const tDashboard = useTranslations("dashboard");
  const t = useTranslations("dashboard.overview");
  // return <NoDataScreen />;

  return (
    <main className="p-5 min-h-full mx-auto">
      <PageInfo
        breadcrumbs={[{ title: tDashboard("title") }, { title: t("title") }]}
      />
      <div className="p-3 px-3 pt-10">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-foreground/70 mt-2">{t("subtitle")}</p>
      </div>
      <DashboardOverviewScreen />
    </main>
  );
}
