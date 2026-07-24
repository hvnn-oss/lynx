import {
  API_KEY_SCOPES,
  USER_PERMISSIONS,
  WORKSPACE_PERMISSIONS,
} from "@repo/constants";
import { ApiKeyIssuancePolicy } from "./api-key-issuance.policy.js";

describe("ApiKeyIssuancePolicy", () => {
  const policy = new ApiKeyIssuancePolicy();

  it("allows only restricted scopes for a workspace admin", () => {
    const access = {
      organizationId: "org-1",
      organizationRole: USER_PERMISSIONS.MEMBER,
      workspaceRole: WORKSPACE_PERMISSIONS.ADMIN,
    };

    expect(() =>
      policy.assertWorkspaceScopes(access, [API_KEY_SCOPES.EVENTS_WRITE]),
    ).not.toThrow();
    expect(() =>
      policy.assertWorkspaceScopes(access, [API_KEY_SCOPES.WORKSPACES_WRITE]),
    ).toThrow("API_KEY_SCOPE_NOT_ALLOWED");
  });
});
