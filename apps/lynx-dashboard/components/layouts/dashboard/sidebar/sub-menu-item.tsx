"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { NavItem } from "./types";

type SubMenuItemProps = {
  item: NavItem;
  isGroupChild?: boolean;
};

export const SubMenuItem = memo(function SubMenuItem({
  item,
  isGroupChild = false,
}: SubMenuItemProps) {
  const t = useTranslations("sidebar");

  return (
    <li>
      <a
        href={item.href}
        className={`block text-muted-foreground rounded-md hover:bg-accent hover:text-accent-foreground transition-colors ${
          isGroupChild ? "px-2 py-1.5 text-sm" : "px-3 py-1.5"
        }`}
      >
        {t(item.label)}
      </a>
    </li>
  );
});
