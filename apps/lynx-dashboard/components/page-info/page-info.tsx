"use client";

import { useEffect } from "react";
import { usePageStore, type BreadcrumbItem } from "@/stores/pageStore";

interface PageInfoProps {
  breadcrumbs: BreadcrumbItem[];
  clearOnUnmount?: boolean;
}

export function PageInfo({
  breadcrumbs,
  clearOnUnmount = true,
}: PageInfoProps) {
  const setBreadcrumbs = usePageStore((state) => state.setBreadcrumbs);
  const clearBreadcrumbs = usePageStore((state) => state.clearBreadcrumbs);
  const breadcrumbsKey = JSON.stringify(breadcrumbs);

  useEffect(() => {
    setBreadcrumbs(JSON.parse(breadcrumbsKey) as BreadcrumbItem[]);

    if (!clearOnUnmount) return;
    return () => {
      clearBreadcrumbs();
    };
  }, [breadcrumbsKey, clearBreadcrumbs, clearOnUnmount, setBreadcrumbs]);

  return null;
}
