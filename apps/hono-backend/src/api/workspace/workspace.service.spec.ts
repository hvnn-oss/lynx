import type { WorkspaceEntity } from "@repo/database";
import type { WorkspaceRepository } from "./workspace.repository.js";
import { WorkspaceService } from "./workspace.service.js";
import type { AccessControlService } from "../../common/access-control/access-control.service.js";
import { CAPABILITIES } from "../../common/access-control/capabilities.js";
import {
  API_KEY_SCOPES,
  USER_PERMISSIONS,
  WORKSPACE_API_KEY_KINDS,
} from "@repo/constants";
import type { ApiKeyIssuancePolicy } from "../api-key/api-key-issuance.policy.js";
import { apiKeyParser } from "../../common/util/api-key-parser.js";
import { createHash } from "node:crypto";
import type { ProductAccessService } from "../../common/access-control/product-access.service.js";

describe("WorkspaceService", () => {
  it("returns the created workspace using the public response contract", async () => {
    const repository = {
      createWorkspace: jest.fn().mockResolvedValue({
        id: "1fe94bb3-7297-4b42-a4fb-f4b04b6857ec",
        name: "Production",
      } as WorkspaceEntity),
    } as unknown as WorkspaceRepository;
    const accessControl = {
      assertOrganizationCapability: jest.fn().mockResolvedValue(undefined),
    } as unknown as AccessControlService;
    const productAccess = {
      grantWorkspaceForUser: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProductAccessService;
    const service = new WorkspaceService(
      repository,
      accessControl,
      undefined,
      productAccess,
    );
    const input = {
      userId: "user-1",
      name: "Production",
      orgId: "70302e18-767c-42d3-9674-80c302475981",
    };

    await expect(service.createWorkspace(input)).resolves.toEqual({
      id: "1fe94bb3-7297-4b42-a4fb-f4b04b6857ec",
      name: "Production",
      orgId: "70302e18-767c-42d3-9674-80c302475981",
    });
    expect(repository.createWorkspace).toHaveBeenCalledWith(input);
    expect(accessControl.assertOrganizationCapability).toHaveBeenCalledWith({
      userId: input.userId,
      organizationId: input.orgId,
      capability: CAPABILITIES.WORKSPACE_CREATE,
    });
    expect(productAccess.grantWorkspaceForUser).toHaveBeenCalledWith(
      input.userId,
      "1fe94bb3-7297-4b42-a4fb-f4b04b6857ec",
    );
  });

  it("returns the raw API key once and stores only its SHA-256 secret hash", async () => {
    const repository = {
      createApiKey: jest.fn().mockImplementation(async (input) => ({
        ...input,
        expiresAt: input.expiresAt,
      })),
    } as unknown as WorkspaceRepository;
    const access = {
      organizationId: "org-1",
      organizationRole: USER_PERMISSIONS.OWNER,
      workspaceRole: null,
    };
    const accessControl = {
      assertWorkspaceCapability: jest.fn().mockResolvedValue(access),
    } as unknown as AccessControlService;
    const apiKeyPolicy = {
      assertWorkspaceScopes: jest.fn(),
    } as unknown as ApiKeyIssuancePolicy;
    const service = new WorkspaceService(
      repository,
      accessControl,
      apiKeyPolicy,
    );
    const input = {
      userId: "user-1",
      workspaceId: "70302e18-767c-42d3-9674-80c302475981",
      name: "Production ingest",
      environment: "production" as const,
      expirePeriodDays: 30,
      kind: WORKSPACE_API_KEY_KINDS.INGEST,
      scopes: [API_KEY_SCOPES.EVENTS_WRITE],
    };

    const result = await service.createApiKey(input);
    const parsed = apiKeyParser(result.key);
    const recordInput = jest.mocked(repository.createApiKey).mock.calls[0]?.[0];

    expect(parsed.id).toBe(result.id);
    expect(recordInput?.keyHash).toBe(
      createHash("sha256").update(result.key).digest("hex"),
    );
    expect(recordInput).not.toHaveProperty("secret");
    expect(recordInput?.prefix.length).toBeLessThanOrEqual(24);
    expect(accessControl.assertWorkspaceCapability).toHaveBeenCalledWith({
      userId: input.userId,
      workspaceId: input.workspaceId,
      capability: CAPABILITIES.WORKSPACE_API_KEY_CREATE,
    });
    expect(apiKeyPolicy.assertWorkspaceScopes).toHaveBeenCalledWith(
      access,
      input.scopes,
    );
  });
});
