export const FIREWALL_SEVERITY = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;

export type FirewallSeverity =
  (typeof FIREWALL_SEVERITY)[keyof typeof FIREWALL_SEVERITY];

export const FIREWALL_ACTIONS = {
  ALLOW: "ALLOW",
  WARN: "WARN",
  BLOCK: "BLOCK",
  REQUIRE_APPROVAL: "REQUIRE_APPROVAL",
} as const;

export type FirewallActions =
  (typeof FIREWALL_ACTIONS)[keyof typeof FIREWALL_ACTIONS];

export const FIREWALL_APPROVAL_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
} as const;

export type FirewallApprovalStatus =
  (typeof FIREWALL_APPROVAL_STATUS)[keyof typeof FIREWALL_APPROVAL_STATUS];

export const WEBHOOK_DELIVERY_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  RETRY_SCHEDULED: "RETRY_SCHEDULED",
  DELIVERED: "DELIVERED",
  FAILED: "FAILED",
} as const;

export type WebhookDeliveryStatus =
  (typeof WEBHOOK_DELIVERY_STATUS)[keyof typeof WEBHOOK_DELIVERY_STATUS];

export const WEBHOOK_DELIVERY_PROVIDER = {
  GENERIC: "GENERIC",
  SLACK: "SLACK",
} as const;

export type WebhookDeliveryProvider =
  (typeof WEBHOOK_DELIVERY_PROVIDER)[keyof typeof WEBHOOK_DELIVERY_PROVIDER];

export const RISK_LEVEL = {
  INFO: "INFO",
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;

export type RiskLevel = (typeof RISK_LEVEL)[keyof typeof RISK_LEVEL];
