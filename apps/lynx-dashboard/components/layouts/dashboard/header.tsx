"use client";
import { LynxLogo } from "@repo/ui/components/brands/lynx-logo";
import { Button } from "@repo/ui/components/ui/button";
import { Search } from "lucide-react";
import Link from "next/link";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@repo/ui/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from "@repo/ui/components/ui/breadcrumb";
import { usePageStore } from "@/stores/pageStore";

export function DashboardHeader() {
  const breadcrumbs = usePageStore((state) => state.breadcrumbs);

  const renderBreadcrumbs = () => {
    if (!breadcrumbs || breadcrumbs.length === 0) return null;

    const items: React.ReactNode[] = [];
    const MAX_ITEMS = 3;

    if (breadcrumbs.length <= MAX_ITEMS) {
      breadcrumbs.forEach((item, index) => {
        const isLast = index === breadcrumbs.length - 1;
        items.push(
          <BreadcrumbItem key={index}>
            {isLast ? (
              <BreadcrumbPage>{item.title}</BreadcrumbPage>
            ) : (
              <BreadcrumbLink asChild>
                <Link href={item.url}>{item.title}</Link>
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>,
        );
        if (!isLast) {
          items.push(<BreadcrumbSeparator key={`sep-${index}`} />);
        }
      });
    } else {
      const firstItem = breadcrumbs[0];
      const secondToLastIdx = breadcrumbs.length - 2;
      const secondToLastItem = breadcrumbs[secondToLastIdx];
      const lastIdx = breadcrumbs.length - 1;
      const lastItem = breadcrumbs[lastIdx];

      if (!firstItem || !secondToLastItem || !lastItem) return null;

      // Render first item
      items.push(
        <BreadcrumbItem key={0}>
          <BreadcrumbLink asChild>
            <Link href={firstItem.url}>{firstItem.title}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>,
      );
      items.push(<BreadcrumbSeparator key="sep-0" />);

      // Render ellipsis
      items.push(
        <BreadcrumbItem key="ellipsis">
          <BreadcrumbEllipsis />
        </BreadcrumbItem>,
      );
      items.push(<BreadcrumbSeparator key="sep-ellipsis" />);

      // Render second-to-last item
      items.push(
        <BreadcrumbItem key={secondToLastIdx}>
          <BreadcrumbLink asChild>
            <Link href={secondToLastItem.url}>{secondToLastItem.title}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>,
      );
      items.push(<BreadcrumbSeparator key={`sep-${secondToLastIdx}`} />);

      // Render last item
      items.push(
        <BreadcrumbItem key={lastIdx}>
          <BreadcrumbPage>{lastItem.title}</BreadcrumbPage>
        </BreadcrumbItem>,
      );
    }

    return (
      <Breadcrumb>
        <BreadcrumbList>{items}</BreadcrumbList>
      </Breadcrumb>
    );
  };

  return (
    <header className="p-10 flex justify-between items-center">
      <div className="flex items-center gap-5">
        <Link
          href={"/"}
          className="flex gap-3 items-center text-2xl select-none"
        >
          <LynxLogo className="size-10" />
        </Link>
        <div>{renderBreadcrumbs()}</div>
      </div>
      <div className="flex gap-5 items-center">
        <div className="flex gap-2">
          <Button variant={"outline"}>기술 문서</Button>
          <Button variant={"outline"} className="pr-4">
            <Search />
            Search
          </Button>
        </div>
      </div>
    </header>
  );
}
