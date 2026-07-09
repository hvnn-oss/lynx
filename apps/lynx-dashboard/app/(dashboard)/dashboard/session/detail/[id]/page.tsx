import { PageInfo } from "@/components/page-info";
import { SessionDetailScreen } from "@/components/screen/session/detail";
import { Button } from "@repo/ui/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";

export default function SessionDetailPage() {
  const tDashboard = useTranslations("dashboard");
  const t = useTranslations("session.detail");

  return (
    <main className="mx-auto min-h-full max-w-280 p-8">
      <PageInfo
        breadcrumbs={[
          { title: tDashboard("title") },
          { title: t("breadcrumbSessions") },
          { title: t("title") },
        ]}
      />
      <div className="mb-5 flex justify-between py-3 pt-10">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="mt-2 text-foreground/70">{t("description")}</p>
        </div>
        <div>
          <Button variant="outline">
            {t("share")}
            <ExternalLink />
          </Button>
        </div>
      </div>
      <SessionDetailScreen />
    </main>
  );
}
