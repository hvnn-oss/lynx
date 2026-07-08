"use client";

import { memo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { NavGroup } from "./types";
import { SubMenuItem } from "./sub-menu-item";

type SubMenuGroupProps = {
  group: NavGroup;
  isOpen: boolean;
  onToggle: () => void;
};

export const SubMenuGroup = memo(function SubMenuGroup({
  group,
  isOpen,
  onToggle,
}: SubMenuGroupProps) {
  const t = useTranslations("sidebar");

  return (
    <li>
      <button
        onClick={onToggle}
        className="w-full flex items-center cursor-pointer justify-between px-3 py-1.5 font-semibold text-foreground rounded-md hover:bg-accent transition-colors"
      >
        <span>{t(group.label)}</span>
        {isOpen ? (
          <ChevronDown className="size-3" />
        ) : (
          <ChevronRight className="size-3" />
        )}
      </button>
      {isOpen && (
        <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-2">
          {group.items.map((item) => (
            <SubMenuItem key={item.href} item={item} isGroupChild />
          ))}
        </ul>
      )}
    </li>
  );
});
