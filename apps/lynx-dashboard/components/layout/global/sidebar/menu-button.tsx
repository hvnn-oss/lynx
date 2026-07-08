"use client";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import picomatch from "picomatch";

export function SidebarMenuButton({
  icon,
  title,
  wildcard,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  wildcard: string;
  href: string;
}) {
  const pathname = usePathname();
  const isPathMatched = picomatch(wildcard);
  const isActivated = isPathMatched(pathname);
  const t = useTranslations("layout.sidebar.items");

  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-1 cursor-pointer size-15 group"
    >
      <div
        className="group-hover:bg-foreground/5 size-10 aspect-square flex items-center justify-center p-1 rounded-md"
        style={{
          background: isActivated
            ? "color-mix(in oklab, var(--color-foreground) 8%, transparent)"
            : undefined,
        }}
      >
        {icon}
      </div>
      <p className="relative text-xs">{t(title)}</p>
    </Link>
  );
}
