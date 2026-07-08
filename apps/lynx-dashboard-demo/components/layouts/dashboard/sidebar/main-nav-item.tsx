"use client";

import { memo } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

type MainNavItemProps = {
  icon: LucideIcon;
  labelKey: string;
  isActive: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
};

export const MainNavItem = memo(function MainNavItem({
  icon: Icon,
  labelKey,
  isActive,
  onClick,
  onMouseEnter,
}: MainNavItemProps) {
  const t = useTranslations("sidebar");

  return (
    <Button
      variant="ghost"
      className={`size-16 h-fit aspect-square flex flex-col gap-1 ${
        isActive ? "bg-card" : ""
      }`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <Icon className="size-6 stroke-[1.5]" />
      <p className="text-xs">{t(labelKey)}</p>
    </Button>
  );
});
