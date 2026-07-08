"use client";

import { PageBreadcrumbs } from "./page-breadcrumbs";

interface PageBreadcrumbBarProps {
  className?: string;
}

export function PageBreadcrumbBar({ className }: PageBreadcrumbBarProps) {
  return (
    <div className={className ?? "flex min-h-10 items-center px-5"}>
      <PageBreadcrumbs />
    </div>
  );
}
