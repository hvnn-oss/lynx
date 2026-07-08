import { OrganizationEntity } from '@repo/database';

export interface SignupStage {
  email: string;
  domain: string;
  email_verified: boolean;
  invited_organization?: string;
}

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface OidcDiscoveryConfig {
  authorization_endpoint?: string;
  token_endpoint?: string;
  userinfo_endpoint?: string;
}

export interface OidcTokenResponse {
  access_token?: string;
  refresh_token?: string;
}

export interface OidcUserProfile {
  sub: string;
  email?: string;
}

export type SsoProvider = 'OIDC' | 'SAML';

export type OidcLoginOrganization = OrganizationEntity & {
  oidcIssuer: string;
  oidcClientId: string;
};

export type OidcCallbackOrganization = OidcLoginOrganization & {
  oidcClientSecret: string;
};
