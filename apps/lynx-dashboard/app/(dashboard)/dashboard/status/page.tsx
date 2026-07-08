import { PageInfo } from "@/components/page-info";
import { useTranslations } from "next-intl";

export default function DashboardStatusPage() {
  const tDashboard = useTranslations("dashboard");
  const t = useTranslations("dashboard.status");
  return (
    <main className="bg-accent p-5   min-h-full">
      <PageInfo
        breadcrumbs={[{ title: tDashboard("title") }, { title: t("title") }]}
      />
      <div className="p-3 px-3 pt-10 max-w-280 mx-auto">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-foreground/70 mt-2">{t("subtitle")}</p>
      </div>
    </main>
  );
}
