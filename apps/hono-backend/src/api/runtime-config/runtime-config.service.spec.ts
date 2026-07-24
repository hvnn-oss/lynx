import { createHash } from "node:crypto";
import type { RuntimeConfigRepository } from "./runtime-config.repository.js";
import { RuntimeConfigService } from "./runtime-config.service.js";

describe("RuntimeConfigService", () => {
  it("returns current prompt versions and activated policies as one revision", async () => {
    const repository = {
      listPrompts: jest.fn().mockResolvedValue([
        {
          id: "72adbb57-96ad-4d3d-a2dc-8faf071673e5",
          name: "support-agent",
          version: {
            id: "c1821bc3-bf1e-46ef-b210-b9376a41cd0c",
            version: "v3",
            content: "You are a support agent.",
          },
        },
      ]),
      listPolicies: jest.fn().mockResolvedValue([
        {
          id: 17n,
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
