import { getTranslations } from "next-intl/server";
import { DashboardPageHeader } from "@repo/ui/components/dashboard/panel";
import { UsePageInfo } from "@/components/util/set-pageinfo";
import { SessionDetailView } from "./session-detail-view";

export async function SessionDetailShell({
  sessionId,
}: {
  sessionId?: string;
}) {
  const t = await getTranslations("session.detail");
  const breadcrumbT = await getTranslations("session.breadcrumbs");

  return (
    <main className="space-y-6 p-6">
      <UsePageInfo
        breadcrumbs={[
          { title: breadcrumbT("dashboard"), url: "/dashboard" },
          { title: breadcrumbT("session"), url: "/dashboard/session/overview" },
          { title: t("title"), url: "/dashboard/session/timeline" },
        ]}
      />

      <DashboardPageHeader description={t("description")} title={t("title")} />

      <SessionDetailView sessionId={sessionId} />
    </main>
  );
}
