export const PRODUCT_ACCESS_MODE = {
  INVITE_ONLY: "INVITE_ONLY",
  PUBLIC: "PUBLIC",
} as const;

export type ProductAccessMode =
  (typeof PRODUCT_ACCESS_MODE)[keyof typeof PRODUCT_ACCESS_MODE];

export const PRODUCT_ACCESS_CAPABILITY = {
  LYNX_CORE: "LYNX_CORE",
} as const;

export type ProductAccessCapability =
  (typeof PRODUCT_ACCESS_CAPABILITY)[keyof typeof PRODUCT_ACCESS_CAPABILITY];

export const PRODUCT_ACCESS_SUBJECT_TYPE = {
  USER: "USER",
  ORGANIZATION: "ORGANIZATION",
  WORKSPACE: "WORKSPACE",
} as const;

export type ProductAccessSubjectType =
  (typeof PRODUCT_ACCESS_SUBJECT_TYPE)[keyof typeof PRODUCT_ACCESS_SUBJECT_TYPE];

export const PRODUCT_ACCESS_GRANT_STATUS = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  EXPIRED: "EXPIRED",
} as const;

export type ProductAccessGrantStatus =
  (typeof PRODUCT_ACCESS_GRANT_STATUS)[keyof typeof PRODUCT_ACCESS_GRANT_STATUS];

export const PRODUCT_ACCESS_STATUS = {
  ...PRODUCT_ACCESS_GRANT_STATUS,
  PENDING: "PENDING",
} as const;

export type ProductAccessStatus =
  (typeof PRODUCT_ACCESS_STATUS)[keyof typeof PRODUCT_ACCESS_STATUS];

export const ACCESS_INVITATION_STATUS = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  EXPIRED: "EXPIRED",
  REVOKED: "REVOKED",
} as const;

export type AccessInvitationStatus =
  (typeof ACCESS_INVITATION_STATUS)[keyof typeof ACCESS_INVITATION_STATUS];

export const ACCESS_INVITATION_TARGET_TYPE = {
  PRODUCT: "PRODUCT",
  ORGANIZATION: "ORGANIZATION",
  WORKSPACE: "WORKSPACE",
} as const;

export type AccessInvitationTargetType =
  (typeof ACCESS_INVITATION_TARGET_TYPE)[keyof typeof ACCESS_INVITATION_TARGET_TYPE];
