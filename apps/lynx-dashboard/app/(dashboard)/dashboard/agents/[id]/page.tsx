import { PageInfo } from "@/components/page-info";
import DashboardAgentItemScreen from "@/components/screen/dashboard/agents/item";
import { useTranslations } from "next-intl";

export default function DashboardAgentInsightPage() {
  const tDashboard = useTranslations("dashboard");
  const t = useTranslations("dashboard.overview");
  return (
    <main className="bg-accent p-5 min-h-full">
      <PageInfo
        breadcrumbs={[
          { title: tDashboard("title") },
          {
            title: "에이전트",
            url: "http://localhost:3000/dashboard/agents/overview",
          },
          { title: "환불 상담 에이전트" },
        ]}
      />
      <div className="p-3 px-3 pt-10 mb-5">
        <h1 className="text-3xl font-bold">환불 상담 에이전트</h1>
        <p className="text-foreground/70 mt-2">
          환불 상담 에이전트의 운영 상태와 대응이 필요한 이슈를 확인하세요.
        </p>
      </div>
      <DashboardAgentItemScreen />
    </main>
  );
}
