"use client";

import { memo, useCallback, useState } from "react";
import { MenuConfig } from "./types";
import { SubMenuItem } from "./sub-menu-item";
import { SubMenuGroup } from "./sub-menu-group";

type SubMenuProps = {
  config: MenuConfig;
};

export const SubMenu = memo(function SubMenu({ config }: SubMenuProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = useCallback((label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }, []);

  if (config.items) {
    return (
      <ul className="mt-1 space-y-0.5">
        {config.items.map((item) => (
          <SubMenuItem key={item.href} item={item} />
        ))}
      </ul>
    );
  }

  if (config.groups) {
    return (
      <ul className="mt-1 space-y-1">
        {config.groups.map((group) => {
          const isOpen = openGroups[group.label] ?? true;
          return (
            <SubMenuGroup
              key={group.label}
              group={group}
              isOpen={isOpen}
              onToggle={() => toggleGroup(group.label)}
            />
          );
        })}
      </ul>
    );
  }

  return null;
});
