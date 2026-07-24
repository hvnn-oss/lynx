export const USER_ENTITLEMENT_TIERS = {
  FREE: "FREE",
  BETA: "BETA",
  PAID: "PAID",
  ENTERPRISE: "ENTERPRISE",
} as const;

export type UserEntitlementTier =
  (typeof USER_ENTITLEMENT_TIERS)[keyof typeof USER_ENTITLEMENT_TIERS];

export const DEFAULT_USER_ENTITLEMENTS = {
  FREE: { maxOwnedOrganizations: 1, dailyOrganizationCreateLimit: 3 },
  BETA: { maxOwnedOrganizations: 3, dailyOrganizationCreateLimit: 10 },
  PAID: { maxOwnedOrganizations: 3, dailyOrganizationCreateLimit: 10 },
  ENTERPRISE: {
    maxOwnedOrganizations: null,
    dailyOrganizationCreateLimit: 20,
  },
} as const;

export const ORGANIZATION_CREATION_SOURCES = {
  SIGNUP: "SIGNUP",
  DASHBOARD: "DASHBOARD",
  API: "API",
  ADMIN: "ADMIN",
} as const;

export type OrganizationCreationSource =
  (typeof ORGANIZATION_CREATION_SOURCES)[keyof typeof ORGANIZATION_CREATION_SOURCES];
