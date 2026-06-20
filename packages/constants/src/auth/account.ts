export const BCRYPT_SALT_ROUNDS = 10;

export const LOGIN_PROVIDERS = {
  LOCAL: "LOCAL",
  OIDC: "OIDC",
  SAML: "SAML",
} as const;

export type LoginProviders =
  (typeof LOGIN_PROVIDERS)[keyof typeof LOGIN_PROVIDERS];
