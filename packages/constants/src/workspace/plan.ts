export const WORKSPACE_PLANS = {
  FREE: "FREE",
  PRO: "PRO",
  ENTERPRISE: "ENTERPRISE",
} as const;

export type WorkspacePlans =
  (typeof WORKSPACE_PLANS)[keyof typeof WORKSPACE_PLANS];
