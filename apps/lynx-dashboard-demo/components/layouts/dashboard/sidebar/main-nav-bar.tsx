"use client";

import { memo } from "react";
import { usePathname } from "next/navigation";
import { MAIN_MENU_ITEMS } from "./constants";
import { MainNavItem } from "./main-nav-item";

type MainNavBarProps = {
  activeMenu: string;
  onNavClick: (key: string) => void;
  onHoverMenu: (key: string) => void;
};

export const MainNavBar = memo(function MainNavBar({
  activeMenu,
  onNavClick,
  onHoverMenu,
}: MainNavBarProps) {
  const pathname = usePathname();

  return (
    <div className="flex-1 flex flex-col">
      {MAIN_MENU_ITEMS.map(({ icon, label, key }) => (
        <MainNavItem
          key={key}
          icon={icon}
          labelKey={label}
          isActive={pathname.startsWith(`/${key}`) || activeMenu === key}
          onClick={() => onNavClick(key)}
          onMouseEnter={() => onHoverMenu(key)}
        />
      ))}
    </div>
  );
});
