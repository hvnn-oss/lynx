import { PageInfo } from "@/components/page-info";
import { IssueTrackerItemScreen } from "@/components/screen/issues/tracker";
import { Button } from "@repo/ui/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";

export default function IssueItemPage() {
  const tDashboard = useTranslations("dashboard");
  const t = useTranslations("dashboard.overview");
  return (
    <main className="p-8 min-h-full max-w-280 mx-auto">
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
      <div className="py-3 pt-10 mb-5 flex justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            비정상 환불 방지 규칙에 의해 동작이 차단됨
          </h1>
          <p className="text-foreground/70 mt-2">
            f2af9002-b992-4bf4-a202-216f4ae1e12e - 30분 전
          </p>
        </div>
        <div>
          <Button variant={"outline"}>
            공유 <ExternalLink />
          </Button>
        </div>
      </div>
      <IssueTrackerItemScreen />
    </main>
  );
}
