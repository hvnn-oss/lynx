import { ISSUE_CATEGORY } from "@repo/constants";
import type { IssueFingerprintInput } from "../types/issue.js";
import {
  canonicalize,
  createIssueFingerprint,
} from "./issue-fingerprint.js";

function input(
  overrides: Partial<IssueFingerprintInput> = {},
): IssueFingerprintInput {
  return {
    category: ISSUE_CATEGORY.TOOL_RISK,
    environment: "production",
    agentId: "agent-1",
    agentVersion: "v3",
    detectorType: "tool-failure",
    tools: ["search", "refund"],
    failedTool: "refund",
    reasonCode: "APPROVAL_MISSING",
    ...overrides,
  };
}

describe("createIssueFingerprint", () => {
  it("returns a lowercase SHA-256 string", () => {
    expect(createIssueFingerprint(input())).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is stable across tool order, duplicates, and context key order", () => {
    const first = createIssueFingerprint(
      input({
        tools: ["refund", "search", "refund"],
        context: { threshold: 1000, currency: "USD" },
      }),
    );
    const second = createIssueFingerprint(
      input({
        tools: ["search", "refund"],
        context: { currency: "USD", threshold: 1000 },
      }),
    );

    expect(first).toBe(second);
  });

  it("changes when the normalized reason changes", () => {
    expect(createIssueFingerprint(input())).not.toBe(
      createIssueFingerprint(input({ reasonCode: "TOOL_TIMEOUT" })),
    );
  });

  it("separates failures from different model providers", () => {
    expect(
      createIssueFingerprint(
        input({ provider: "openai", model: "gpt-4.1-mini" }),
      ),
    ).not.toBe(
      createIssueFingerprint(
        input({ provider: "anthropic", model: "claude-sonnet" }),
      ),
    );
  });

  it("rejects an empty required identity field", () => {
    expect(() => createIssueFingerprint(input({ agentId: "  " }))).toThrow(
      "Issue fingerprint fields must not be empty",
    );
  });
});

describe("canonicalize", () => {
  it("sorts nested object keys without changing array order", () => {
    expect(
      canonicalize({
        z: { second: 2, first: 1 },
        a: ["second", "first"],
      }),
    ).toBe('{"a":["second","first"],"z":{"first":1,"second":2}}');
  });
});
