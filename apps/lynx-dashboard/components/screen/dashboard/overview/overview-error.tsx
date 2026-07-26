import { DashboardPanel } from "@repo/ui/components/dashboard/panel";
import { Button } from "@repo/ui/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

export function OverviewError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("dashboard.overview.error");

  return (
    <DashboardPanel className="flex min-h-48 flex-col items-center justify-center text-center">
      <p className="text-sm font-medium">{t("title")}</p>
      <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
        {t("description")}
      </p>
      <Button className="mt-4" size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw className="size-4" aria-hidden="true" />
        {t("action")}
      </Button>
    </DashboardPanel>
  );
}
