import { PageInfo } from "@/components/page-info";
import { DashboardOverviewScreen } from "@/components/screen/dashboard/overview";
import { DashboardPageHeader } from "@repo/ui/components/dashboard/panel";
import { useTranslations } from "next-intl";

export default function DashboardOverviewPage() {
  const tDashboard = useTranslations("dashboard");
  const t = useTranslations("dashboard.overview");
  return (
    <main className="mx-auto min-h-full max-w-[1600px] p-5">
      <PageInfo
        breadcrumbs={[{ title: tDashboard("title") }, { title: t("title") }]}
      />
      <div className="space-y-8 pt-10">
        <DashboardPageHeader title={t("title")} description={t("subtitle")} />
        <DashboardOverviewScreen />
      </div>
    </main>
  );
}
