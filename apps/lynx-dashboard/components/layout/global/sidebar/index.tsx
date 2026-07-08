"use client";
import {
  BrickWallFire,
  ChartPie,
  GitPullRequestArrow,
  Settings,
} from "lucide-react";
import { SidebarUserAvatar } from "./user-avatar";
import { SidebarMenuButton } from "./menu-button";
import Image from "next/image";
import { sidebarItems } from "@/config/dashboard/sidebar/items";

export default function DashboardSidebar() {
  return (
    <section className="pb-8 p-4 pt-8 flex flex-col gap-10 items-center justify-between">
      <div>
        <div className="size-10 rounded-xl bg-white overflow-hidden relative">
          <Image
            className="w-full h-full object-cover"
            src={"https://avatars.githubusercontent.com/u/260204659?s=200&v=4"}
            alt="company-logo"
            fill
            unoptimized
          />
        </div>
      </div>
      <div className="flex flex-col gap-5 flex-1">
        {sidebarItems.map((item) => (
          <SidebarMenuButton
            key={`sidebar-item-${item.title}`}
            icon={item.icon}
            title={item.title}
            wildcard={item.wildcard}
            href={item.defaultHref}
          />
        ))}
      </div>
      <div>
        <SidebarUserAvatar />
      </div>
    </section>
  );
}
