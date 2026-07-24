/** Organization-level plans shared by every workspace in the organization. */
export const ORGANIZATION_PLANS = {
  FREE: "FREE",
  PRO: "PRO",
  ENTERPRISE: "ENTERPRISE",
} as const;

export type OrganizationPlanCode =
  (typeof ORGANIZATION_PLANS)[keyof typeof ORGANIZATION_PLANS];

/** @deprecated Plans are owned by organizations, not individual workspaces. */
export const WORKSPACE_PLANS = ORGANIZATION_PLANS;

/** @deprecated Use `OrganizationPlanCode`. */
export type WorkspacePlans = OrganizationPlanCode;
