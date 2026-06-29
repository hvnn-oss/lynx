"use client";

import { useTranslations } from "next-intl";

interface NoDataScreenProps {
  title?: string;
  description?: string;
}

export default function NoDataScreen({
  title,
  description,
}: NoDataScreenProps) {
  const t = useTranslations("dashboard.home.empty");

  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center p-6 text-center">
      <div>
        <h2 className="text-lg font-semibold tracking-normal">
          {title ?? t("title")}
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {description ?? t("description")}
        </p>
      </div>
    </div>
  );
}
