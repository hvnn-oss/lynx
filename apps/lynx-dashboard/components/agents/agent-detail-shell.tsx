import { getTranslations } from "next-intl/server";
import { DashboardPageHeader } from "@repo/ui/components/dashboard/panel";
import { UsePageInfo } from "@/components/util/set-pageinfo";
import { AgentDetailView } from "./agent-detail-view";

export async function AgentDetailShell({ agentId }: { agentId: string }) {
  const t = await getTranslations("agent.detail");
  const breadcrumbT = await getTranslations("agent.breadcrumbs");

  return (
    <main className="space-y-6 p-6">
      <UsePageInfo
        breadcrumbs={[
          { title: breadcrumbT("dashboard"), url: "/dashboard" },
          { title: breadcrumbT("agents"), url: "/agents" },
          { title: t("title"), url: `/agents/${agentId}` },
        ]}
      />

      <DashboardPageHeader description={t("description")} title={t("title")} />

      <AgentDetailView agentId={agentId} />
    </main>
  );
}

