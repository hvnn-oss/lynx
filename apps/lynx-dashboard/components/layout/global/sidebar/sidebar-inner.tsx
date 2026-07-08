"use client";
import {
  sidebarItems,
  SidebarItemType,
} from "@/config/dashboard/sidebar/items";
import SidebarInnerLink from "./sidebar-inner-link";
import picomatch from "picomatch";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export default function SidebarInner() {
  return (
    <div className="bg-surface border-r py-10 px-8 w-70 min-h-full sticky top-0 flex flex-col gap-5">
      {sidebarItems.map((item) => {
        const isPathMatched = picomatch(item.wildcard);
        if (!isPathMatched) return;
        return (
          <SidebarRenderer
            key={`sidebar-inner-container-${item.title}`}
            item={item}
          />
        );
      })}
    </div>
  );
}

function SidebarRenderer({ item }: { item: SidebarItemType }) {
  const pathname = usePathname();
  const isPathMatched = picomatch(item.wildcard);
  const t = useTranslations("layout.sidebar.items");
  if (!isPathMatched(pathname)) return;

  return (
    <div className="flex flex-col gap-5">
      {item.items.map((item) => (
        <div
          className="font-semibold flex flex-col gap-3"
          key={`sidebar-inner-item-${item.title}`}
        >
          <p className="text-sm text-foreground/50">{t(item.title)}</p>
          <div className="flex flex-col">
            {item.items.map((item) => (
              <SidebarInnerLink
                key={`sidebar-inner-item-contents-${item.title}`}
                href={item.href}
                title={item.title}
                wildcard={item.wildcard}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
