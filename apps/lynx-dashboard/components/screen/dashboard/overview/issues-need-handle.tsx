import { cn } from "@/lib/utils";
import { buttonVariants } from "@repo/ui/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { IssueItem } from "../../../ui/dashboard/issue-item";
import { DangerLevelType } from "@/components/ui/dashboard/danger-level-badge";
import { useTranslations } from "next-intl";

export default function DashboardOverviewIssueNeedHandle() {
  const t = useTranslations("dashboard");
  return (
    <div className="h-full bg-background col-start-3 col-end-5 min-h-52 py-5 rounded-md">
      <div className="flex justify-between items-center px-5">
        <h2 className="font-bold">{t("overview.issues.importants.title")}</h2>
        <Link
          className={cn(
            buttonVariants({
              variant: "outline",
            }),
            "border border-border w-fit rounded-full flex justify-center items-center",
          )}
          href={"/issues/ciritical"}
        >
          {t("ui.see_more")}
          <ArrowUpRight className="size-5" strokeWidth={1} />
        </Link>
      </div>
      <div className="mt-3">
        <IssueItem
          title="비정상 환불 방지 규칙에 의해 동작이 차단됨"
          sessionId="e3e78869-af5f-40a2-ba2d-921daae6687f"
          level={DangerLevelType.CRITICAL}
        />
        <IssueItem
          title="비정상 환불 방지 규칙에 의해 동작이 차단됨"
          sessionId="605e2108-0486-4800-8874-b992649bcb4a"
          level={DangerLevelType.CRITICAL}
        />
        <IssueItem
          title="잘못된 정보 제공 방지 규칙에 의해 동작이 차단됨"
          sessionId="2401c097-b003-44fd-8f89-58f35e12e6da"
          level={DangerLevelType.CRITICAL}
        />
        <IssueItem
          title="비속어 방지 규칙에 의해 문제가 탐지됨"
          sessionId="d5723ab2-968b-486d-91b1-6cbddb0df7cd"
          level={DangerLevelType.WARN}
        />
        <IssueItem
          title="비속어 방지 규칙에 의해 문제가 탐지됨"
          sessionId="3039bd06-0489-45d1-9583-bc8ec22c8b16"
          level={DangerLevelType.WARN}
        />
      </div>
    </div>
  );
}
