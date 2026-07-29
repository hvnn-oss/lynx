import { createHash, generateKeyPairSync, verify } from "node:crypto";
import type { RuntimeConfigRepository } from "./runtime-config.repository.js";
import { RuntimeConfigService } from "./runtime-config.service.js";
import { env } from "../../../common/config/config.js";

describe("RuntimeConfigService", () => {
  it("returns current prompt versions and activated policies as one revision", async () => {
    const repository = {
      resolveAgentId: jest.fn().mockResolvedValue(undefined),
      listPromptDeployments: jest.fn().mockResolvedValue([
        {
          promptId: "72adbb57-96ad-4d3d-a2dc-8faf071673e5",
          agentId: null,
          prompt: { name: "support-agent" },
          version: {
            id: "c1821bc3-bf1e-46ef-b210-b9376a41cd0c",
            version: "v3",
            content: "You are a support agent.",
            contentHash: null,
          },
        },
      ]),
      listActiveExperiments: jest.fn().mockResolvedValue([]),
      listPromptVersions: jest.fn().mockResolvedValue([]),
      listPolicies: jest.fn().mockResolvedValue([
        {
          policy: { id: 17n },
          name: "Block destructive tools",
          description: null,
          version: "v2",
          condition: "tool.riskLevel == 'CRITICAL'",
          severity: "CRITICAL",
          action: "BLOCK",
        },
      ]),
    } as unknown as RuntimeConfigRepository;

    const result = await new RuntimeConfigService(repository).get(
      "workspace-1",
      "production",
      undefined,
      "client-1",
    );

    expect(result.prompts).toEqual([
      expect.objectContaining({
        name: "support-agent",
        version: "v3",
        contentHash: createHash("sha256")
          .update("You are a support agent.")
          .digest("hex"),
      }),
    ]);
    expect(result.policies).toEqual([
      expect.objectContaining({
        policyId: "17",
        action: "BLOCK",
      }),
    ]);
    expect(result.revision).toMatch(/^[0-9a-f]{64}$/);
  });
});

it("signs the exact runtime bundle with the configured Ed25519 key", async () => {
  const originalPrivateKey = env.RUNTIME_CONFIG_SIGNING_PRIVATE_KEY;
  const originalKeyId = env.RUNTIME_CONFIG_SIGNING_KEY_ID;
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  env.RUNTIME_CONFIG_SIGNING_PRIVATE_KEY = privateKey.export({
    type: "pkcs8",
    format: "pem",
  });
  env.RUNTIME_CONFIG_SIGNING_KEY_ID = "test-key";
  const repository = {
    resolveAgentId: jest.fn().mockResolvedValue(undefined),
    listPromptDeployments: jest.fn().mockResolvedValue([]),
    listActiveExperiments: jest.fn().mockResolvedValue([]),
    listPromptVersions: jest.fn().mockResolvedValue([]),
    listPolicies: jest.fn().mockResolvedValue([]),
  } as unknown as RuntimeConfigRepository;

  try {
    const result = await new RuntimeConfigService(repository).get(
      "workspace-1",
    );
    const payload = JSON.stringify({
      revision: result.revision,
      prompts: result.prompts,
      policies: result.policies,
    });
    expect(result.signing?.keyId).toBe("test-key");
    expect(
      verify(
        null,
        Buffer.from(payload),
        publicKey,
        Buffer.from(result.signing!.signature, "base64url"),
      ),
    ).toBe(true);
  } finally {
    env.RUNTIME_CONFIG_SIGNING_PRIVATE_KEY = originalPrivateKey;
    env.RUNTIME_CONFIG_SIGNING_KEY_ID = originalKeyId;
  }
});

it("prioritizes Agent deployments and assigns an A/B variant deterministically", async () => {
  const promptId = "72adbb57-96ad-4d3d-a2dc-8faf071673e5";
  const internalAgentId = "34640358-38db-4bc7-a700-6d61d1536298";
  const defaultVersion = {
    id: "c1821bc3-bf1e-46ef-b210-b9376a41cd0c",
    version: "v1",
    content: "default",
    contentHash: null,
  };
  const agentVersion = {
    id: "aa5d1f6b-173e-4b14-a42e-fc7077f8ea90",
    version: "v2",
    content: "agent",
    contentHash: null,
  };
  const experimentVersion = {
    id: "f78f96b3-a1bd-45ce-8b7f-0db424ddaa56",
    version: "v3",
    content: "experiment",
    contentHash: null,
  };
  const repository = {
    resolveAgentId: jest.fn().mockResolvedValue(internalAgentId),
    listPromptDeployments: jest.fn().mockResolvedValue([
      {
        promptId,
        agentId: null,
        prompt: { name: "support-agent" },
        version: defaultVersion,
      },
      {
        promptId,
        agentId: internalAgentId,
        prompt: { name: "support-agent" },
        version: agentVersion,
      },
    ]),
    listActiveExperiments: jest.fn().mockResolvedValue([
      {
        id: "experiment-1",
        promptId,
        agentId: internalAgentId,
        assignmentSalt: "stable-salt",
        variants: [{ versionId: experimentVersion.id, weight: 100 }],
      },
    ]),
    listPromptVersions: jest.fn().mockResolvedValue([experimentVersion]),
    listPolicies: jest.fn().mockResolvedValue([]),
  } as unknown as RuntimeConfigRepository;
  const service = new RuntimeConfigService(repository);

  const first = await service.get(
    "workspace-1",
    "staging",
    "orbit-assistant",
    "client-1",
  );
  const second = await service.get(
    "workspace-1",
    "staging",
    "orbit-assistant",
    "client-1",
  );

  expect(first.prompts[0]).toEqual(
    expect.objectContaining({
      promptId,
      versionId: experimentVersion.id,
      content: "experiment",
    }),
  );
  expect(second).toBe(first);
  expect(repository.listPromptDeployments).toHaveBeenCalledWith(
    "workspace-1",
    "staging",
    internalAgentId,
  );
  expect(repository.resolveAgentId).toHaveBeenCalledWith(
    "workspace-1",
    "orbit-assistant",
  );
});
