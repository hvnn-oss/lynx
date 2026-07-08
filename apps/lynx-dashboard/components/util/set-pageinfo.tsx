"use client";

import { PageInfo } from "@/components/page-info/page-info";
import type { BreadcrumbItem } from "@/stores/pageStore";

interface UsePageInfoProps {
  breadcrumbs: BreadcrumbItem[];
}

export function UsePageInfo({ breadcrumbs }: UsePageInfoProps) {
  return <PageInfo breadcrumbs={breadcrumbs} />;
}
