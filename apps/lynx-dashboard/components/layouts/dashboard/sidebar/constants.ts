import { Brain, BugOff, ChartArea, Settings } from "lucide-react";
import { MenuConfig } from "./types";

export const menuConfig: Record<string, MenuConfig> = {
  dashboard: {
    title: "dashboard.title",
    groups: [
      {
        label: "dashboard.items.overview.title",
        items: [
          { label: "dashboard.items.overview.home", href: "/dashboard" },
          {
            label: "dashboard.items.overview.status",
            href: "/dashboard/status",
          },
          {
            label: "dashboard.items.overview.metrics",
            href: "/dashboard/metrics",
          },
          { label: "dashboard.items.overview.usage", href: "/dashboard/usage" },
          { label: "dashboard.items.overview.cost", href: "/dashboard/cost" },
          {
            label: "dashboard.items.overview.insights",
            href: "/dashboard/insights",
          },
        ],
      },
      {
        label: "session.items.list.title",
        items: [
          {
            label: "session.items.list.overview",
            href: "/dashboard/session/overview",
          },
          { label: "session.items.list.live", href: "/dashboard/session/live" },
          {
            label: "session.items.list.completed",
            href: "/dashboard/session/completed",
          },
          {
            label: "session.items.list.failed",
            href: "/dashboard/session/failed",
          },
          {
            label: "session.items.list.anomaly",
            href: "/dashboard/session/anomaly",
          },
        ],
      },
      {
        label: "dashboard.items.live-monitoring.title",
        items: [
          {
            label: "dashboard.items.live-monitoring.live",
            href: "/dashboard/live",
          },
          {
            label: "dashboard.items.live-monitoring.live-agents",
            href: "/dashboard/active-agents",
          },
          {
            label: "dashboard.items.live-monitoring.alerts",
            href: "/dashboard/alerts",
          },
        ],
      },
    ],
  },
  agents: {
    title: "agents.title",
    groups: [
      {
        label: "agents.items.management.title",
        items: [
          {
            label: "agents.items.management.overview",
            href: "/agents",
          },
          { label: "agents.items.management.active", href: "/agents/active" },
          {
            label: "agents.items.management.inactive",
            href: "/agents/inactive",
          },
          { label: "agents.items.management.groups", href: "/agents/groups" },
        ],
      },
      {
        label: "agents.items.behavior.title",
        items: [
          { label: "agents.items.behavior.intent", href: "/agents/intent" },
          { label: "agents.items.behavior.tools", href: "/agents/tools" },
          { label: "agents.items.behavior.saas", href: "/agents/saas" },
          { label: "agents.items.behavior.history", href: "/agents/history" },
        ],
      },
      {
        label: "agents.items.performance.title",
        items: [
          {
            label: "agents.items.performance.latency",
            href: "/agents/perf/latency",
          },
          {
            label: "agents.items.performance.tokens",
            href: "/agents/perf/tokens",
          },
          {
            label: "agents.items.performance.success-rate",
            href: "/agents/perf/success-rate",
          },
          { label: "agents.items.performance.cost", href: "/agents/perf/cost" },
        ],
      },
    ],
  },
  debug: {
    title: "debug.title",
    groups: [
      {
        label: "debug.items.trace.title",
        items: [
          { label: "debug.items.trace.logs", href: "/debug/logs" },
          { label: "debug.items.trace.trace", href: "/debug/trace" },
          { label: "debug.items.trace.tool-calls", href: "/debug/tool-calls" },
          { label: "debug.items.trace.llm-io", href: "/debug/llm-io" },
        ],
      },
      {
        label: "debug.items.error.title",
        items: [
          { label: "debug.items.error.errors", href: "/debug/errors" },
          { label: "debug.items.error.root-cause", href: "/debug/root-cause" },
          {
            label: "debug.items.error.failure-patterns",
            href: "/debug/failure-patterns",
          },
          { label: "debug.items.error.reproduce", href: "/debug/reproduce" },
        ],
      },
      {
        label: "debug.items.performance.title",
        items: [
          {
            label: "debug.items.performance.bottleneck",
            href: "/debug/bottleneck",
          },
          { label: "debug.items.performance.latency", href: "/debug/latency" },
          { label: "debug.items.performance.memory", href: "/debug/memory" },
        ],
      },
    ],
  },
  settings: {
    title: "settings.title",
    groups: [
      {
        label: "settings.items.workspace.title",
        items: [
          {
            label: "settings.items.workspace.general",
            href: "/settings/general",
          },
          {
            label: "settings.items.workspace.members",
            href: "/settings/members",
          },
          { label: "settings.items.workspace.roles", href: "/settings/roles" },
          {
            label: "settings.items.workspace.billing",
            href: "/settings/billing",
          },
        ],
      },
      {
        label: "settings.items.integration.title",
        items: [
          {
            label: "settings.items.integration.api-keys",
            href: "/settings/api-keys",
          },
          { label: "settings.items.integration.sdk", href: "/settings/sdk" },
          {
            label: "settings.items.integration.webhooks",
            href: "/settings/webhooks",
          },
          {
            label: "settings.items.integration.slack",
            href: "/settings/slack",
          },
        ],
      },
      {
        label: "settings.items.notification.title",
        items: [
          {
            label: "settings.items.notification.channels",
            href: "/settings/notifications/channels",
          },
          {
            label: "settings.items.notification.rules",
            href: "/settings/notifications/rules",
          },
          {
            label: "settings.items.notification.preferences",
            href: "/settings/notifications/preferences",
          },
        ],
      },
    ],
  },
};

export const MAIN_MENU_ITEMS = [
  { icon: ChartArea, label: "menu.dashboard", key: "dashboard" },
  { icon: Brain, label: "menu.agents", key: "agents" },
  { icon: BugOff, label: "menu.debug", key: "debug" },
  { icon: Settings, label: "menu.settings", key: "settings" },
];
