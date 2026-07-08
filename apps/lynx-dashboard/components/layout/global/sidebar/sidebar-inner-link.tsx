"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import picomatch from "picomatch";
import { useEffect } from "react";

export default function SidebarInnerLink({
  href,
  title,
  wildcard,
}: {
  href: string;
  title: string;
  wildcard?: string | string[];
}) {
  const pathname = usePathname();
  const isPathMatched = picomatch(wildcard ?? "");
  const isActivated = wildcard ? isPathMatched(pathname) : href === pathname;
  const t = useTranslations("layout.sidebar.items");

  useEffect(() => {
    console.log(wildcard);
    console.log(isActivated);
  }, [isActivated, wildcard]);

  return (
    <Link
      className="text-foreground/80 p-2 font-medium hover:font-semibold rounded-md hover:bg-accent hover:text-foreground transition-all "
      style={{
        backgroundColor: isActivated
          ? "color-mix(in oklab, var(--color-foreground) 5%, transparent)"
          : undefined,
        color: isActivated ? "var(--color-foreground)" : undefined,
        fontWeight: isActivated ? "var(--font-weight-semibold)" : undefined,
      }}
      href={href}
    >
      {t(title)}
    </Link>
  );
}
