import { createHash } from "node:crypto";
import { API_KEY_SCOPES, WORKSPACE_API_KEY_KINDS } from "@repo/constants";
import type { WorkspaceApiKeyEntity } from "@repo/database";
import type { WorkspaceApiKeyAuthRepository } from "./workspace-api-key-auth.repository.js";
import { WorkspaceApiKeyAuthService } from "./workspace-api-key-auth.service.js";

describe("WorkspaceApiKeyAuthService", () => {
  const rawApiKey =
    "lynx_production_70302e18-767c-42d3-9674-80c302475981_secret";

  function createService(values: Partial<WorkspaceApiKeyEntity> = {}) {
    const apiKey = {
      id: "70302e18-767c-42d3-9674-80c302475981",
      workspaceId: "1fe94bb3-7297-4b42-a4fb-f4b04b6857ec",
      keyHash: createHash("sha256").update(rawApiKey).digest("hex"),
      kind: WORKSPACE_API_KEY_KINDS.INGEST,
      scopes: [API_KEY_SCOPES.EVENTS_WRITE],
      revokedAt: undefined,
      expiresAt: undefined,
      ...values,
    } as WorkspaceApiKeyEntity;
    const repository = {
      findById: jest.fn().mockResolvedValue(apiKey),
      touchLastUsed: jest.fn().mockResolvedValue(undefined),
    } as unknown as WorkspaceApiKeyAuthRepository;
    return { repository, service: new WorkspaceApiKeyAuthService(repository) };
  }

  it("authenticates an active key with the required scope", async () => {
    const { service } = createService();

    await expect(
      service.authenticate(rawApiKey, [API_KEY_SCOPES.EVENTS_WRITE]),
    ).resolves.toEqual({
      apiKeyId: "70302e18-767c-42d3-9674-80c302475981",
      workspaceId: "1fe94bb3-7297-4b42-a4fb-f4b04b6857ec",
      environment: "production",
      scopes: [API_KEY_SCOPES.EVENTS_WRITE],
    });
  });

  it("rejects revoked and modified keys", async () => {
    const revoked = createService({ revokedAt: new Date() }).service;
    const active = createService().service;

    await expect(revoked.authenticate(rawApiKey)).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      active.authenticate(`${rawApiKey}-modified`),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a key without the required scope", async () => {
    const { service } = createService();

    await expect(
      service.authenticate(rawApiKey, [API_KEY_SCOPES.POLICIES_READ]),
    ).rejects.toMatchObject({ status: 403 });
  });
});
