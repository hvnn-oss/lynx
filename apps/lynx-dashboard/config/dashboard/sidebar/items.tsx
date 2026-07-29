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
        title: "issues.work.title",
        items: [
          {
            title: "issues.work.overview",
            href: "/issues/overview",
            wildcard: "/issues/overview/**",
          },
          {
            title: "issues.work.review",
            href: "/issues/review",
            wildcard: "/issues/review/**",
          },
          {
            title: "issues.work.investigating",
            href: "/issues/investigating",
            wildcard: "/issues/investigating/**",
          },
          {
            title: "issues.work.recovery",
            href: "/issues/recovery",
            wildcard: "/issues/recovery/**",
          },
        ],
      },
      {
        title: "issues.analysis.title",
        items: [
          {
            title: "issues.analysis.patterns",
            href: "/issues/patterns",
            wildcard: "/issues/patterns/**",
          },
          {
            title: "issues.analysis.changeImpact",
            href: "/issues/change-impact",
            wildcard: "/issues/change-impact/**",
          },
        ],
      },
      {
        title: "issues.records.title",
        items: [
          {
            title: "issues.records.history",
            href: "/issues/history",
            wildcard: "/issues/history/**",
          },
          {
            title: "issues.records.intake",
            href: "/issues/intake",
            wildcard: "/issues/intake/**",
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
            wildcard: "/firewall/overview/**",
          },
          {
            title: "firewall.summary.policies",
            href: "/firewall/policies",
            wildcard: "/firewall/policies/**",
          },
          {
            title: "firewall.summary.approvals",
            href: "/firewall/approvals",
            wildcard: "/firewall/approvals/**",
          },
          {
            title: "firewall.summary.records",
            href: "/firewall/records",
            wildcard: "/firewall/records/**",
          },
          {
            title: "firewall.summary.lab",
            href: "/firewall/lab",
            wildcard: "/firewall/lab/**",
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
        title: "prompts.management.title",
        items: [
          {
            title: "prompts.management.library",
            href: "/prompts/overview",
            wildcard: [
              "/prompts/overview",
              "/prompts/overview/**",
              "/prompts/new",
              "/prompts/new/**",
              "/prompts/????????-????-????-????-????????????",
            ],
          },
          {
            title: "prompts.management.deployments",
            href: "/prompts/deployments",
            wildcard: "/prompts/deployments/**",
          },
        ],
      },
      {
        title: "prompts.optimization.title",
        items: [
          {
            title: "prompts.optimization.experiments",
            href: "/prompts/experiments",
            wildcard: "/prompts/experiments/**",
          },
          {
            title: "prompts.optimization.performance",
            href: "/prompts/regressions",
            wildcard: "/prompts/regressions/**",
          },
        ],
      },
    ],
  },

  // 설정
  {
    title: "settings.title",
    icon: <Settings className="size-6" />,
    defaultHref: "/settings/organization/general",
    wildcard: "/settings/**",
    items: [
      {
        title: "settings.organization.title",
        items: [
          {
            title: "settings.organization.general",
            href: "/settings/organization/general",
          },
          {
            title: "settings.organization.members",
            href: "/settings/organization/members",
          },
          {
            title: "settings.organization.integrations",
            href: "/settings/organization/integrations",
          },
          {
            title: "settings.organization.apiKeys",
            href: "/settings/organization/api-keys",
          },
          {
            title: "settings.organization.security",
            href: "/settings/organization/security",
          },
        ],
      },
      {
        title: "settings.personal.title",
        items: [
          {
            title: "settings.personal.general",
            href: "/settings/personal/general",
          },
          {
            title: "settings.personal.security",
            href: "/settings/personal/security",
          },
          {
            title: "settings.personal.preferences",
            href: "/settings/personal/preferences",
          },
        ],
      },
      {
        title: "settings.openapi.title",
        items: [
          {
            title: "settings.openapi.general",
            href: "/settings/openapi/general",
          },
          {
            title: "settings.openapi.ingestion",
            href: "/settings/openapi/ingestion",
          },
          {
            title: "settings.openapi.runtimeConfig",
            href: "/settings/openapi/runtime-config",
          },
        ],
      },
    ],
  },
];
