"use client";

import { useEffect } from "react";
import { usePageStore, type BreadcrumbItem } from "@/stores/pageStore";

interface UsePageInfoProps {
  breadcrumbs: BreadcrumbItem[];
}

export function UsePageInfo({ breadcrumbs }: UsePageInfoProps) {
  const setBreadcrumbs = usePageStore((state) => state.setBreadcrumbs);
  
  const breadcrumbsStr = JSON.stringify(breadcrumbs);

  useEffect(() => {
    setBreadcrumbs(breadcrumbs);
  }, [breadcrumbsStr, setBreadcrumbs]);

  return null;
}

