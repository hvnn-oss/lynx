"use client";

import type { DashboardBootstrapResponseDto } from "@repo/dto";
import { Button } from "@repo/ui/components/ui/button";
import { Clock3, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

interface AccessPendingProps {
  user: DashboardBootstrapResponseDto["user"];
  access: DashboardBootstrapResponseDto["access"];
  isRefreshing: boolean;
  onRefresh: () => void;
}

/** 인증은 완료됐지만 제품 접근 승인을 기다리는 사용자에게 상태를 안내합니다. */
export function AccessPending({
  user,
  access,
  isRefreshing,
  onRefresh,
}: AccessPendingProps) {
  const t = useTranslations("access");

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-6">
      <section className="w-full max-w-lg rounded-lg border bg-background p-8">
        <div className="mb-5 flex size-10 items-center justify-center rounded-full border bg-muted/40">
          <Clock3 className="size-5 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold">{t("pending.title")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("pending.description", { email: user.email })}
        </p>
        <dl className="mt-6 grid gap-3 border-y py-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">{t("pending.mode")}</dt>
            <dd className="font-medium">{t(`mode.${access.mode}`)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">{t("pending.status")}</dt>
            <dd className="font-medium">{t(`status.${access.status}`)}</dd>
          </div>
        </dl>
        <Button
          className="mt-6 w-full"
          variant="outline"
          disabled={isRefreshing}
          onClick={onRefresh}
        >
          <RefreshCw
            className={isRefreshing ? "size-4 animate-spin" : "size-4"}
          />
          {t("pending.refresh")}
        </Button>
      </section>
    </main>
  );
}
