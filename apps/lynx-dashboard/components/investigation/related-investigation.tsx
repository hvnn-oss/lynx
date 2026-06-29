"use client";

import Link from "next/link";
import { ArrowRight, GitBranch, Search } from "lucide-react";
import { DashboardPanel } from "@repo/ui/components/dashboard/panel";
import { Button } from "@repo/ui/components/ui/button";

export interface RelatedInvestigationItem {
  label: string;
  value: string;
  href?: string;
  tone?: "neutral" | "good" | "warning" | "bad";
}

export interface RelatedInvestigationAction {
  label: string;
  href: string;
}

export function RelatedInvestigationPanel({
  title = "Related investigation",
  description,
  items,
  actions,
}: {
  title?: string;
  description?: string;
  items: RelatedInvestigationItem[];
  actions: RelatedInvestigationAction[];
}) {
  return (
    <DashboardPanel>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <GitBranch className="size-4 text-muted-foreground" />
            <p className="text-sm font-semibold">{title}</p>
          </div>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {actions.slice(0, 4).map((action) => (
            <Button asChild key={`${action.label}-${action.href}`} size="sm" variant="outline">
              <Link href={action.href}>
                {action.label}
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
        {items.slice(0, 8).map((item) => (
          <RelatedInvestigationCell
            item={item}
            key={`${item.label}-${item.value}`}
          />
        ))}
      </div>
    </DashboardPanel>
  );
}

function RelatedInvestigationCell({ item }: { item: RelatedInvestigationItem }) {
  const content = (
    <div className="flex min-h-16 items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2 transition hover:bg-muted/30">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">
          {item.label}
        </p>
        <p className="mt-1 truncate text-sm font-semibold">{item.value}</p>
      </div>
      {item.href ? (
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
      ) : null}
    </div>
  );

  return item.href ? <Link href={item.href}>{content}</Link> : content;
}

