import {
  BrickWallFire,
  ChartPie,
  GitPullRequestArrow,
  Settings,
  TriangleAlert,
} from "lucide-react";
import React from "react";

export interface SidebarItemType {
  title: string;
  icon: React.ReactNode;
  defaultHref: string;
  wildcard: string;
  items: SidebarInnerItemType[];
}

export interface SidebarInnerItemType {
  title: string;
  items: {
    title: string;
    href: string;
    wildcard?: string | string[];
  }[];
}

export const sidebarItems: SidebarItemType[] = [
  // 대시보드
  {
    title: "dashboard.title",
    icon: <ChartPie className="size-6" />,
    defaultHref: "/dashboard/overview",
    wildcard: "/dashboard/**",
    items: [
      {
        title: "dashboard.summary.title",
        items: [
          {
            title: "dashboard.summary.overview",
            href: "/dashboard/overview",
            wildcard: "/dashboard/overview/**",
          },
          {
            title: "dashboard.summary.status",
            href: "/dashboard/status",
            wildcard: "/dashboard/status/**",
          },
          {
            title: "dashboard.summary.cost",
            href: "/dashboard/cost",
            wildcard: "/dashboard/cost/**",
          },
          {
            title: "dashboard.summary.reports",
            href: "/dashboard/reports",
            wildcard: "/dashboard/reports/**",
          },
        ],
      },
      {
        title: "dashboard.sessions.title",
        items: [
          {
            title: "dashboard.sessions.overview",
            href: "/dashboard/sessions/overview",
            wildcard: "/dashboard/sessions/overview/**",
          },
          {
            title: "dashboard.sessions.completed",
            href: "/dashboard/sessions/completed",
            wildcard: "/dashboard/sessions/completed/**",
          },
          {
            title: "dashboard.sessions.failed",
            href: "/dashboard/sessions/failed",
            wildcard: "/dashboard/sessions/failed/**",
          },
        ],
      },
      {
        title: "dashboard.agents.title",
        items: [
          {
            title: "dashboard.agents.overview",
            href: "/dashboard/agents/overview",
            wildcard: "/dashboard/agents/overview/**",
          },
          {
            title: "dashboard.agents.active",
            href: "/dashboard/agents/active",
            wildcard: "/dashboard/agents/active/**",
          },
          {
            title: "dashboard.agents.inactive",
            href: "/dashboard/agents/inactive",
            wildcard: "/dashboard/agents/inactive/**",
          },
        ],
      },
    ],
  },

  // 이슈
  {
    title: "issues.title",
    icon: <TriangleAlert className="size-6" />,
    defaultHref: "/issues/overview",
    wildcard: "/issues/**",
    items: [
      {
        title: "issues.tracker.title",
        items: [
          {
            title: "issues.tracker.overview",
            href: "/issues/overview",
            wildcard: "/issues/(overview|tracker)/**",
          },
          {
            title: "issues.tracker.review",
            href: "/issues/review",
            wildcard: "/issues/review/**",
          },
          {
            title: "issues.tracker.fingerprints",
            href: "/issues/fingerprints",
            wildcard: "/issues/fingerprints/**",
          },
          {
            title: "issues.tracker.trends",
            href: "/issues/trends",
            wildcard: "/issues/trends/**",
          },
          {
            title: "issues.tracker.blocked",
            href: "/issues/blocked",
            wildcard: "/issues/blocked/**",
          },
        ],
      },
    ],
  },

  // 방화벽
  {
    title: "firewall.title",
    icon: <BrickWallFire className="size-6" />,
    defaultHref: "/firewall/overview",
    wildcard: "/firewall/**",
    items: [
      {
        title: "firewall.summary.title",
        items: [
          {
            title: "firewall.summary.overview",
            href: "/firewall/overview",
            wildcard: "/firewall/(overview|policies)/**",
          },
          {
            title: "firewall.summary.blockedEvents",
            href: "/firewall/blocked-events",
            wildcard: "/firewall/blocked-events/**",
          },
          {
            title: "firewall.summary.policyCoverage",
            href: "/firewall/policy-coverage",
            wildcard: "/firewall/policy-coverage/**",
          },
          {
            title: "firewall.summary.riskTools",
            href: "/firewall/risk-tools",
            wildcard: "/firewall/risk-tools/**",
          },
          {
            title: "firewall.summary.simulation",
            href: "/firewall/simulation",
            wildcard: "/firewall/simulation/**",
          },
        ],
      },
    ],
  },

  // 프롬프트 버저닝
  {
    title: "prompts.title",
    icon: <GitPullRequestArrow className="size-6" />,
    defaultHref: "/prompts/overview",
    wildcard: "/prompts/**",
    items: [
      {
        title: "prompts.summary.title",
        items: [
          {
            title: "prompts.summary.overview",
            href: "/prompts/overview",
            wildcard: "/prompts/overview/**",
          },
          {
            title: "prompts.summary.changes",
            href: "/prompts/changes",
            wildcard: "/prompts/changes/**",
          },
          {
            title: "prompts.summary.regressions",
            href: "/prompts/regressions",
            wildcard: "/prompts/regressions/**",
          },
          {
            title: "prompts.summary.compare",
            href: "/prompts/compare",
            wildcard: "/prompts/compare/**",
          },
          {
            title: "prompts.summary.deployments",
            href: "/prompts/deployments",
            wildcard: "/prompts/deployments/**",
          },
        ],
      },
    ],
  },

  // 설정
  {
    title: "settings.title",
    icon: <Settings className="size-6" />,
    defaultHref: "/settings/overview",
    wildcard: "/settings/**",
    items: [
      {
        title: "summary",
        items: [
          {
            title: "dashboard.overview",
            href: "/dashboard/overview",
            wildcard: "/dashboard/overview/**",
          },
        ],
      },
    ],
  },
];
