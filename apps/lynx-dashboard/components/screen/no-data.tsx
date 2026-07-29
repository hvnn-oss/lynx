"use client";

import { Button, buttonVariants } from "@repo/ui/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export function NoDataScreen() {
  const t = useTranslations("dashboard.noData");

  return (
    <main className="my-30 flex h-full w-full flex-col items-center justify-center gap-5">
      <div className="flex flex-col items-center gap-5 text-center">
        <div>
          <h1 className="text-lg font-bold">{t("title")}</h1>
          <p className="text-sm">{t("description")}</p>
        </div>
        <div className="flex gap-1">
          <Link
            href="https://docs.lynxops.co/"
            className={buttonVariants({
              variant: "default",
              className: "group border border-border",
            })}
          >
            {t("connect")}
            <ArrowRight className="transition-all duration-300 group-hover:ml-2" />
          </Link>
          <Button variant="outline" onClick={() => window.location.reload()}>
            {t("refresh")}
          </Button>
        </div>
      </div>
    </main>
  );
}
