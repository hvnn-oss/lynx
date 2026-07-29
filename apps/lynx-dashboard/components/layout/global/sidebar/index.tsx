"use client";
import { SidebarUserAvatar } from "./user-avatar";
import { SidebarMenuButton } from "./menu-button";
import Image from "next/image";
import { sidebarItems } from "@/config/dashboard/sidebar/items";
import { useUserStore } from "@/stores/userStore";

export default function DashboardSidebar() {
  const organization = useUserStore((state) => {
    const activeOrganization = state.organizations.find(
      (item) => item.id === state.activeOrganizationId,
    );
    return activeOrganization ?? state.organizations[0] ?? null;
  });
  const organizationInitials = getInitials(organization?.name);

  return (
    <section className="pb-8 p-4 pt-8 flex flex-col gap-10 items-center justify-between">
      <div>
        <div className="size-10 rounded-xl bg-white overflow-hidden relative">
          {organization?.profileImageUrl ? (
            <Image
              className="h-full w-full object-cover"
              src={organization.profileImageUrl}
              alt={organization.name}
              fill
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-xs font-semibold text-muted-foreground">
              {organizationInitials}
            </div>
          )}
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

function getInitials(name?: string) {
  if (!name) return "LY";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
