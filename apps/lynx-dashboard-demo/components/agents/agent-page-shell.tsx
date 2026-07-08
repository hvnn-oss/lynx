import { getTranslations } from "next-intl/server";
import { DashboardPageHeader } from "@repo/ui/components/dashboard/panel";
import { UsePageInfo } from "@/components/util/set-pageinfo";
import { AgentPageView, type AgentViewKind } from "./agent-page-view";

export async function AgentPageShell({ kind }: { kind: AgentViewKind }) {
  const t = await getTranslations(`agent.pages.${kind}`);
  const breadcrumbT = await getTranslations("agent.breadcrumbs");

  return (
    <main className="space-y-6 p-6">
      <UsePageInfo
        breadcrumbs={[
          { title: breadcrumbT("dashboard"), url: "/dashboard" },
          { title: breadcrumbT("agents"), url: "/agents" },
          { title: t("title"), url: getAgentPath(kind) },
        ]}
      />

      <DashboardPageHeader description={t("description")} title={t("title")} />

      <AgentPageView kind={kind} />
    </main>
  );
}

function getAgentPath(kind: AgentViewKind) {
  if (kind === "overview") return "/agents";
  if (
    kind === "latency" ||
    kind === "tokens" ||
    kind === "success-rate" ||
    kind === "cost"
  ) {
    return `/agents/perf/${kind}`;
  }
  return `/agents/${kind}`;
}

