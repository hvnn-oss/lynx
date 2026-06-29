import { getTranslations } from "next-intl/server";
import { DashboardPageHeader } from "@repo/ui/components/dashboard/panel";
import { UsePageInfo } from "@/components/util/set-pageinfo";
import { DebugPageView, type DebugPageKind } from "./debug-page-view";

export async function DebugPageShell({ kind }: { kind: DebugPageKind }) {
  const t = await getTranslations(`debug.pages.${kind}`);
  const breadcrumbT = await getTranslations("debug.breadcrumbs");

  return (
    <main className="space-y-6 p-6">
      <UsePageInfo
        breadcrumbs={[
          { title: breadcrumbT("dashboard"), url: "/dashboard" },
          { title: breadcrumbT("debug"), url: "/debug/logs" },
          { title: t("title"), url: `/debug/${kind}` },
        ]}
      />

      <DashboardPageHeader description={t("description")} title={t("title")} />

      <DebugPageView kind={kind} />
    </main>
  );
}
