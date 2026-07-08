"use client";

import { memo } from "react";
import { ChevronLast } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@repo/ui/components/ui/button";

type SubMenuHeaderProps = {
  titleKey: string;
  isPinned: boolean;
  onTogglePin: () => void;
};

export const SubMenuHeader = memo(function SubMenuHeader({
  titleKey,
  isPinned,
  onTogglePin,
}: SubMenuHeaderProps) {
  const t = useTranslations("sidebar");

  return (
    <div className="w-full flex justify-between items-center mt-10 mb-5 px-2">
      <h2 className="font-semibold">{t(titleKey)}</h2>
      <Button
        className="w-3 h-3 p-3"
        onClick={onTogglePin}
        variant={isPinned ? "default" : "outline"}
      >
        <ChevronLast className="size-4" strokeWidth={isPinned ? 3 : 2} />
      </Button>
    </div>
  );
});
