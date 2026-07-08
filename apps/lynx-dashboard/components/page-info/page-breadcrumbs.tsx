"use client";

import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem as BreadcrumbListItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/ui/components/ui/breadcrumb";
import {
  usePageStore,
  type BreadcrumbItem as PageBreadcrumbItem,
} from "@/stores/pageStore";

interface PageBreadcrumbsProps {
  items?: PageBreadcrumbItem[];
  maxItems?: number;
  className?: string;
}

export function PageBreadcrumbs({
  items,
  maxItems = 3,
  className,
}: PageBreadcrumbsProps) {
  const storedItems = usePageStore((state) => state.breadcrumbs);
  const breadcrumbs = items ?? storedItems;

  if (!breadcrumbs || breadcrumbs.length === 0) return null;

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {renderBreadcrumbItems(breadcrumbs, maxItems)}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function renderBreadcrumbItems(
  breadcrumbs: PageBreadcrumbItem[],
  maxItems: number,
) {
  if (breadcrumbs.length <= maxItems) {
    return breadcrumbs.flatMap((item, index) =>
      renderItemWithSeparator(item, index, index === breadcrumbs.length - 1),
    );
  }

  const firstItem = breadcrumbs[0];
  const secondToLastIndex = breadcrumbs.length - 2;
  const secondToLastItem = breadcrumbs[secondToLastIndex];
  const lastItem = breadcrumbs[breadcrumbs.length - 1];

  if (!firstItem || !secondToLastItem || !lastItem) return null;

  return [
    ...renderItemWithSeparator(firstItem, 0, false),
    <BreadcrumbListItem key="ellipsis">
      <BreadcrumbEllipsis />
    </BreadcrumbListItem>,
    <BreadcrumbSeparator key="sep-ellipsis" />,
    ...renderItemWithSeparator(secondToLastItem, secondToLastIndex, false),
    ...renderItemWithSeparator(lastItem, breadcrumbs.length - 1, true),
  ];
}

function renderItemWithSeparator(
  item: PageBreadcrumbItem,
  index: number,
  isLast: boolean,
) {
  const breadcrumbItem = (
    <BreadcrumbListItem key={`item-${index}`}>
      {isLast || !item.url ? (
        <BreadcrumbPage>{item.title}</BreadcrumbPage>
      ) : (
        <BreadcrumbLink asChild>
          <Link href={item.url}>{item.title}</Link>
        </BreadcrumbLink>
      )}
    </BreadcrumbListItem>
  );

  if (isLast) return [breadcrumbItem];

  return [breadcrumbItem, <BreadcrumbSeparator key={`sep-${index}`} />];
}
