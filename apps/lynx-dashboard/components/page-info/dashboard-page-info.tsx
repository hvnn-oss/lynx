"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { BreadcrumbItem } from "@/stores/pageStore";
import { PageInfo } from "./page-info";

/** 대시보드 라우트에 맞는 breadcrumb를 공통 헤더에 등록합니다. */
export function DashboardPageInfo() {
  const pathname = normalizePath(usePathname());
  const navigation = useTranslations("layout.sidebar.items");
  const details = useTranslations("detailPages");
  const firewall = useTranslations("firewall");
  const issues = useTranslations("issues");
  const prompts = useTranslations("promptManagement");
  const settings = useTranslations("settings");

  const dashboardRoot = breadcrumb(
    navigation("dashboard.title"),
    "/dashboard/overview",
  );
  const issueRoot = breadcrumb(navigation("issues.title"), "/issues/overview");
  const firewallRoot = breadcrumb(
    navigation("firewall.title"),
    "/firewall/overview",
  );
  const promptRoot = breadcrumb(
    navigation("prompts.title"),
    "/prompts/overview",
  );
  const settingsRoot = breadcrumb(
    navigation("settings.title"),
    "/settings/organization/general",
  );

  const exactRoutes: Record<string, BreadcrumbItem[]> = {
    "/": [dashboardRoot, breadcrumb(navigation("dashboard.summary.overview"))],
    "/dashboard": [
      dashboardRoot,
      breadcrumb(navigation("dashboard.summary.overview")),
    ],
    "/dashboard/overview": [
      dashboardRoot,
      breadcrumb(navigation("dashboard.summary.overview")),
    ],
    "/dashboard/status": [
      dashboardRoot,
      breadcrumb(navigation("dashboard.summary.status")),
    ],
    "/dashboard/cost": [
      dashboardRoot,
      breadcrumb(navigation("dashboard.summary.cost")),
    ],
    "/dashboard/reports": [
      dashboardRoot,
      breadcrumb(navigation("dashboard.summary.reports")),
    ],
    "/dashboard/sessions/overview": [
      dashboardRoot,
      breadcrumb(
        navigation("dashboard.sessions.title"),
        "/dashboard/sessions/overview",
      ),
      breadcrumb(navigation("dashboard.sessions.overview")),
    ],
    "/dashboard/sessions/completed": [
      dashboardRoot,
      breadcrumb(
        navigation("dashboard.sessions.title"),
        "/dashboard/sessions/overview",
      ),
      breadcrumb(navigation("dashboard.sessions.completed")),
    ],
    "/dashboard/sessions/failed": [
      dashboardRoot,
      breadcrumb(
        navigation("dashboard.sessions.title"),
        "/dashboard/sessions/overview",
      ),
      breadcrumb(navigation("dashboard.sessions.failed")),
    ],
    "/dashboard/agents/overview": [
      dashboardRoot,
      breadcrumb(
        navigation("dashboard.agents.title"),
        "/dashboard/agents/overview",
      ),
      breadcrumb(navigation("dashboard.agents.overview")),
    ],
    "/dashboard/agents/active": [
      dashboardRoot,
      breadcrumb(
        navigation("dashboard.agents.title"),
        "/dashboard/agents/overview",
      ),
      breadcrumb(navigation("dashboard.agents.active")),
    ],
    "/dashboard/agents/inactive": [
      dashboardRoot,
      breadcrumb(
        navigation("dashboard.agents.title"),
        "/dashboard/agents/overview",
      ),
      breadcrumb(navigation("dashboard.agents.inactive")),
    ],
    "/issues/overview": [
      issueRoot,
      breadcrumb(navigation("issues.work.title"), "/issues/overview"),
      breadcrumb(navigation("issues.work.overview")),
    ],
    "/issues/review": [
      issueRoot,
      breadcrumb(navigation("issues.work.title"), "/issues/overview"),
      breadcrumb(navigation("issues.work.review")),
    ],
    "/issues/investigating": [
      issueRoot,
      breadcrumb(navigation("issues.work.title"), "/issues/overview"),
      breadcrumb(navigation("issues.work.investigating")),
    ],
    "/issues/recovery": [
      issueRoot,
      breadcrumb(navigation("issues.work.title"), "/issues/overview"),
      breadcrumb(navigation("issues.work.recovery")),
    ],
    "/issues/patterns": [
      issueRoot,
      breadcrumb(navigation("issues.analysis.title"), "/issues/patterns"),
      breadcrumb(navigation("issues.analysis.patterns")),
    ],
    "/issues/fingerprints": [
      issueRoot,
      breadcrumb(navigation("issues.analysis.title"), "/issues/patterns"),
      breadcrumb(navigation("issues.analysis.patterns")),
    ],
    "/issues/change-impact": [
      issueRoot,
      breadcrumb(navigation("issues.analysis.title"), "/issues/patterns"),
      breadcrumb(navigation("issues.analysis.changeImpact")),
    ],
    "/issues/history": [
      issueRoot,
      breadcrumb(navigation("issues.records.title"), "/issues/history"),
      breadcrumb(navigation("issues.records.history")),
    ],
    "/issues/intake": [
      issueRoot,
      breadcrumb(navigation("issues.records.title"), "/issues/history"),
      breadcrumb(navigation("issues.records.intake")),
    ],
    "/issues/blocked": [issueRoot, breadcrumb(issues("blocked.title"))],
    "/issues/trends": [
      issueRoot,
      breadcrumb(navigation("issues.work.overview")),
    ],
    "/firewall/overview": [
      firewallRoot,
      breadcrumb(navigation("firewall.summary.overview")),
    ],
    "/firewall/policies": [
      firewallRoot,
      breadcrumb(navigation("firewall.summary.policies")),
    ],
    "/firewall/approvals": [
      firewallRoot,
      breadcrumb(navigation("firewall.summary.approvals")),
    ],
    "/firewall/risk-tools": [
      firewallRoot,
      breadcrumb(navigation("firewall.summary.approvals")),
    ],
    "/firewall/records": [
      firewallRoot,
      breadcrumb(navigation("firewall.summary.records")),
    ],
    "/firewall/blocked-events": [
      firewallRoot,
      breadcrumb(navigation("firewall.summary.records")),
    ],
    "/firewall/lab": [
      firewallRoot,
      breadcrumb(navigation("firewall.summary.lab")),
    ],
    "/firewall/simulation": [
      firewallRoot,
      breadcrumb(navigation("firewall.summary.lab")),
    ],
    "/firewall/policy-coverage": [
      firewallRoot,
      breadcrumb(navigation("firewall.summary.policies")),
    ],
    "/prompts/overview": [
      promptRoot,
      breadcrumb(navigation("prompts.management.title"), "/prompts/overview"),
      breadcrumb(navigation("prompts.management.library")),
    ],
    "/prompts/new": [
      promptRoot,
      breadcrumb(navigation("prompts.management.library"), "/prompts/overview"),
      breadcrumb(prompts("create.title")),
    ],
    "/prompts/deployments": [
      promptRoot,
      breadcrumb(navigation("prompts.management.title"), "/prompts/overview"),
      breadcrumb(navigation("prompts.management.deployments")),
    ],
    "/prompts/experiments": [
      promptRoot,
      breadcrumb(
        navigation("prompts.optimization.title"),
        "/prompts/experiments",
      ),
      breadcrumb(navigation("prompts.optimization.experiments")),
    ],
    "/prompts/regressions": [
      promptRoot,
      breadcrumb(
        navigation("prompts.optimization.title"),
        "/prompts/experiments",
      ),
      breadcrumb(navigation("prompts.optimization.performance")),
    ],
    "/prompts/changes": [
      promptRoot,
      breadcrumb(navigation("prompts.summary.changes")),
    ],
    "/prompts/compare": [
      promptRoot,
      breadcrumb(navigation("prompts.summary.compare")),
    ],
    "/settings": [
      settingsRoot,
      breadcrumb(navigation("settings.organization.general")),
    ],
    "/settings/organization/general": [
      settingsRoot,
      breadcrumb(
        navigation("settings.organization.title"),
        "/settings/organization/general",
      ),
      breadcrumb(settings("organization.generalTitle")),
    ],
    "/settings/organization/members": [
      settingsRoot,
      breadcrumb(
        navigation("settings.organization.title"),
        "/settings/organization/general",
      ),
      breadcrumb(settings("organization.membersTitle")),
    ],
    "/settings/organization/integrations": [
      settingsRoot,
      breadcrumb(
        navigation("settings.organization.title"),
        "/settings/organization/general",
      ),
      breadcrumb(settings("organization.integrationsTitle")),
    ],
    "/settings/organization/api-keys": [
      settingsRoot,
      breadcrumb(
        navigation("settings.organization.title"),
        "/settings/organization/general",
      ),
      breadcrumb(settings("organization.apiKeysTitle")),
    ],
    "/settings/organization/security": [
      settingsRoot,
      breadcrumb(
        navigation("settings.organization.title"),
        "/settings/organization/general",
      ),
      breadcrumb(settings("organization.securityTitle")),
    ],
    "/settings/personal/general": [
      settingsRoot,
      breadcrumb(
        navigation("settings.personal.title"),
        "/settings/personal/general",
      ),
      breadcrumb(settings("personal.generalTitle")),
    ],
    "/settings/personal/security": [
      settingsRoot,
      breadcrumb(
        navigation("settings.personal.title"),
        "/settings/personal/general",
      ),
      breadcrumb(settings("personal.securityTitle")),
    ],
    "/settings/personal/preferences": [
      settingsRoot,
      breadcrumb(
        navigation("settings.personal.title"),
        "/settings/personal/general",
      ),
      breadcrumb(settings("personal.preferencesTitle")),
    ],
    "/settings/openapi/general": [
      settingsRoot,
      breadcrumb(
        navigation("settings.openapi.title"),
        "/settings/openapi/general",
      ),
      breadcrumb(settings("openapi.generalTitle")),
    ],
    "/settings/openapi/ingestion": [
      settingsRoot,
      breadcrumb(
        navigation("settings.openapi.title"),
        "/settings/openapi/general",
      ),
      breadcrumb(settings("openapi.ingestionTitle")),
    ],
    "/settings/openapi/runtime-config": [
      settingsRoot,
      breadcrumb(
        navigation("settings.openapi.title"),
        "/settings/openapi/general",
      ),
      breadcrumb(settings("openapi.runtimeTitle")),
    ],
  };

  const breadcrumbs =
    exactRoutes[pathname] ??
    getDynamicBreadcrumbs(pathname, {
      dashboardRoot,
      issueRoot,
      firewallRoot,
      promptRoot,
      agentSection: navigation("dashboard.agents.title"),
      sessionSection: navigation("dashboard.sessions.title"),
      issueOverview: navigation("issues.work.overview"),
      firewallPolicies: navigation("firewall.summary.policies"),
      promptLibrary: navigation("prompts.management.library"),
      agentDetail: details("agent.title"),
      sessionDetail: details("session.title"),
      issueDetail: issues("detail.title"),
      policyDetail: firewall("editor.title"),
      policyNew: firewall("editor.newTitle"),
      promptDetail: prompts("editor.title"),
    });

  return <PageInfo breadcrumbs={breadcrumbs} clearOnUnmount={false} />;
}

interface DynamicBreadcrumbLabels {
  dashboardRoot: BreadcrumbItem;
  issueRoot: BreadcrumbItem;
  firewallRoot: BreadcrumbItem;
  promptRoot: BreadcrumbItem;
  agentSection: string;
  sessionSection: string;
  issueOverview: string;
  firewallPolicies: string;
  promptLibrary: string;
  agentDetail: string;
  sessionDetail: string;
  issueDetail: string;
  policyDetail: string;
  policyNew: string;
  promptDetail: string;
}

/** ID가 포함된 상세 경로의 breadcrumb를 개인정보 노출 없이 구성합니다. */
function getDynamicBreadcrumbs(
  pathname: string,
  labels: DynamicBreadcrumbLabels,
): BreadcrumbItem[] {
  if (/^\/dashboard\/agents\/[^/]+$/.test(pathname)) {
    return [
      labels.dashboardRoot,
      breadcrumb(labels.agentSection, "/dashboard/agents/overview"),
      breadcrumb(labels.agentDetail),
    ];
  }

  if (/^\/dashboard\/session\/detail\/[^/]+$/.test(pathname)) {
    return [
      labels.dashboardRoot,
      breadcrumb(labels.sessionSection, "/dashboard/sessions/overview"),
      breadcrumb(labels.sessionDetail),
    ];
  }

  if (/^\/issues\/tracker\/[^/]+$/.test(pathname)) {
    return [
      labels.issueRoot,
      breadcrumb(labels.issueOverview, "/issues/overview"),
      breadcrumb(labels.issueDetail),
    ];
  }

  if (/^\/issues\/[^/]+$/.test(pathname)) {
    return [
      labels.issueRoot,
      breadcrumb(labels.issueOverview, "/issues/overview"),
      breadcrumb(labels.issueDetail),
    ];
  }

  if (/^\/firewall\/policies\/new$/.test(pathname)) {
    return [
      labels.firewallRoot,
      breadcrumb(labels.firewallPolicies, "/firewall/policies"),
      breadcrumb(labels.policyNew),
    ];
  }

  if (/^\/firewall\/policies\/[^/]+$/.test(pathname)) {
    return [
      labels.firewallRoot,
      breadcrumb(labels.firewallPolicies, "/firewall/policies"),
      breadcrumb(labels.policyDetail),
    ];
  }

  if (/^\/prompts\/[^/]+$/.test(pathname)) {
    return [
      labels.promptRoot,
      breadcrumb(labels.promptLibrary, "/prompts/overview"),
      breadcrumb(labels.promptDetail),
    ];
  }

  return [];
}

/** 마지막 슬래시 유무와 관계없이 동일한 라우트로 취급합니다. */
function normalizePath(pathname: string): string {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

/** breadcrumb 항목 생성을 한 곳에서 처리해 링크 누락을 방지합니다. */
function breadcrumb(title: string, url?: string): BreadcrumbItem {
  return { title, url };
}
