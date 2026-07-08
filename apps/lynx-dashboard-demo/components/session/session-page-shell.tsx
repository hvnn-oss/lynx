import { getTranslations } from "next-intl/server";
import { DashboardPageHeader } from "@repo/ui/components/dashboard/panel";
import { UsePageInfo } from "@/components/util/set-pageinfo";
import { SessionPageView, type SessionViewKind } from "./session-page-view";

export async function SessionPageShell({ kind }: { kind: SessionViewKind }) {
  const t = await getTranslations(`session.pages.${kind}`);
  const breadcrumbT = await getTranslations("session.breadcrumbs");

  return (
    <main className="space-y-6 p-6">
      <UsePageInfo
        breadcrumbs={[
          { title: breadcrumbT("dashboard"), url: "/dashboard" },
          { title: breadcrumbT("session"), url: "/dashboard/session/overview" },
          { title: t("title"), url: `/dashboard/session/${kind}` },
        ]}
      />

      <DashboardPageHeader description={t("description")} title={t("title")} />

      <SessionPageView kind={kind} />
    </main>
  );
}
