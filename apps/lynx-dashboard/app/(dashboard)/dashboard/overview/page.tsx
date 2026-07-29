import { DashboardOverviewScreen } from "@/components/screen/dashboard/overview";
import { DashboardPageHeader } from "@repo/ui/components/dashboard/panel";
import { useTranslations } from "next-intl";

export default function DashboardOverviewPage() {
  const t = useTranslations("dashboard.overview");
  return (
    <main className="mx-auto min-h-full max-w-[1600px] py-5 px-20">
      <div className="space-y-8 pt-10">
        <DashboardPageHeader title={t("title")} description={t("subtitle")} />
        <DashboardOverviewScreen />
      </div>
    </main>
  );
}
