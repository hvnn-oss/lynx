import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  sign as signPayload,
} from "node:crypto";
import { afterEach, test } from "node:test";
import { LynxPolicyError, LynxTracer } from "../dist/index.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function prompt(version, content) {
  return {
    promptId: "72adbb57-96ad-4d3d-a2dc-8faf071673e5",
    name: "support-agent",
    versionId:
      version === "v1"
        ? "c1821bc3-bf1e-46ef-b210-b9376a41cd0c"
        : "ea3ed621-69c6-4859-9b3e-66521cb68ce4",
    version,
    content,
    contentHash: createHash("sha256").update(content).digest("hex"),
  };
}

function createTracer(overrides = {}) {
  return new LynxTracer({
    clientId: "test-client",
    endpoint: "http://lynx.test",
    apiKey: "test-api-key",
    delivery: { flushIntervalMs: 60_000 },
    runtimeConfig: { enabled: false },
    ...overrides,
  });
}

test("getPrompt loads and caches the current managed prompt", async () => {
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, headers: init.headers });
    return new Response(
      JSON.stringify({
        revision: "revision-1",
        prompts: [prompt("v1", "Be concise.")],
        policies: [],
      }),
      { status: 200, headers: { ETag: '"revision-1"' } },
    );
  };

  const tracer = createTracer({
    agentId: "675a2136-57fd-44af-8e1e-c77a7d2034c8",
  });
  const first = await tracer.getPrompt("support-agent");
  const second = await tracer.getPrompt(first.promptId);

  assert.equal(first.content, "Be concise.");
  assert.strictEqual(first, second);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "http://lynx.test/openapi/v1/runtime-config");
  assert.equal(requests[0].headers["X-API-Key"], "test-api-key");
  assert.equal(requests[0].headers["X-Lynx-Client-ID"], "test-client");
  assert.equal(
    requests[0].headers["X-Lynx-Agent-ID"],
    "675a2136-57fd-44af-8e1e-c77a7d2034c8",
  );
  assert.equal(tracer.getStatus().runtimeConfig.state, "READY");
  await tracer.shutdown();
});

test("a run keeps its first prompt version across a later refresh", async () => {
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    const current =
      requestCount === 1
        ? prompt("v1", "Version one")
        : prompt("v2", "Version two");
    return new Response(
      JSON.stringify({
        revision: `revision-${requestCount}`,
        prompts: [current],
        policies: [],
      }),
      { status: 200 },
    );
  };

  const tracer = createTracer();
  await tracer.run("SupportAgent", async () => {
    const first = await tracer.getPrompt("support-agent");
    await assert.rejects(() => tracer.getPrompt("missing-prompt"));
    const pinned = await tracer.getPrompt("support-agent");

    assert.equal(first.version, "v1");
    assert.strictEqual(first, pinned);
  });
  assert.equal(requestCount, 2);
  await tracer.shutdown();
});

test("a failed refresh preserves the last-known-good bundle", async () => {
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    if (requestCount === 1) {
      return new Response(
        JSON.stringify({
          revision: "revision-1",
          prompts: [prompt("v1", "Stable prompt")],
          policies: [],
        }),
        { status: 200 },
      );
    }
    return new Response("unavailable", { status: 503 });
  };

  const tracer = createTracer();
  const stable = await tracer.getPrompt("support-agent");
  await assert.rejects(() => tracer.getPrompt("missing-prompt"));

  assert.equal(
    (await tracer.getPrompt("support-agent")).content,
    stable.content,
  );
  assert.equal(tracer.getStatus().runtimeConfig.state, "STALE");
  await tracer.shutdown();
});

test("automatic first-run loading fails open when Lynx is unavailable", async () => {
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/runtime-config")) {
      return new Response("unavailable", { status: 503 });
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  const tracer = createTracer({ runtimeConfig: { enabled: true } });
  let executed = false;

  await tracer.run("SupportAgent", () => {
    executed = true;
  });

  assert.equal(executed, true);
  assert.equal(tracer.getStatus().runtimeConfig.state, "ERROR");
  await tracer.shutdown();
});

test("firewallTool blocks a call that matches a cached managed policy", async () => {
  const telemetry = [];
  const issueRecords = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/runtime-config")) {
      return new Response(
        JSON.stringify({
          revision: "policy-revision-1",
          prompts: [],
          policies: [
            {
              policyId: "17",
              name: "Block critical tools",
              description: "Critical tools require an operator review.",
              version: "v2",
              condition: "tool.riskLevel == 'CRITICAL'",
              severity: "CRITICAL",
              action: "BLOCK",
            },
          ],
        }),
        { status: 200 },
      );
    }
    if (String(url).endsWith("/issue-records")) {
      issueRecords.push(JSON.parse(init.body));
      return new Response(
        JSON.stringify({
          recordId: "4acb9bfb-36c7-49bc-bd69-13a930cff154",
          status: "RECEIVED",
          isNew: true,
        }),
        { status: 202 },
      );
    }
    telemetry.push(...JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  const tracer = createTracer({ runtimeConfig: { enabled: true } });
  let executed = false;
  const destructiveTool = tracer.firewallTool(
    "delete-account",
    async () => {
      executed = true;
    },
    { riskLevel: "CRITICAL", sideEffect: true },
  );

  await assert.rejects(
    () => tracer.run("SupportAgent", () => destructiveTool({ userId: "1" })),
    (error) => {
      assert.ok(error instanceof LynxPolicyError);
      assert.equal(error.policyId, "17");
      assert.equal(error.action, "BLOCK");
      return true;
    },
  );
  await tracer.shutdown();

  assert.equal(executed, false);
  const evaluation = telemetry.find(
    (event) => event.eventType === "POLICY_EVALUATION",
  );
  assert.equal(evaluation.payload.policyId, "17");
  assert.equal(evaluation.payload.policyVersion, "v2");
  assert.equal(issueRecords.length, 1);
  assert.equal(issueRecords[0].detectionType, "FIREWALL_BLOCK");
  assert.equal(issueRecords[0].policyId, "17");
  assert.equal(issueRecords[0].payload.toolName, "delete-account");
  assert.equal(issueRecords[0].payload.policyName, "Block critical tools");
  assert.equal(
    issueRecords[0].payload.condition,
    "tool.riskLevel == 'CRITICAL'",
  );
  assert.equal(issueRecords[0].payload.input, undefined);
});

test("managed policies block matching LLM input and output content", async () => {
  const telemetry = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/runtime-config")) {
      return new Response(
        JSON.stringify({
          revision: "content-policy-revision-1",
          prompts: [],
          policies: [
            {
              policyId: "input-policy",
              name: "Block greeting input",
              description: null,
              version: "v1",
              condition: "input.value contains '안녕'",
              severity: "HIGH",
              action: "BLOCK",
            },
            {
              policyId: "output-policy",
              name: "Block unsafe output",
              description: null,
              version: "v1",
              condition: "output.value contains '차단'",
              severity: "HIGH",
              action: "BLOCK",
            },
          ],
        }),
        { status: 200 },
      );
    }
    if (String(url).endsWith("/issue-records")) {
      return new Response(
        JSON.stringify({
          recordId: "4acb9bfb-36c7-49bc-bd69-13a930cff155",
          status: "RECEIVED",
          isNew: true,
        }),
        { status: 202 },
      );
    }
    telemetry.push(...JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  const tracer = createTracer({ runtimeConfig: { enabled: true } });

  await tracer.run("SupportAgent", () => {
    assert.throws(
      () =>
        tracer.firewallInput("안녕하세요", {
          captureContent: false,
        }),
      (error) =>
        error instanceof LynxPolicyError && error.policyId === "input-policy",
    );
    assert.throws(
      () => tracer.firewallOutput("이 답변은 차단 대상입니다."),
      (error) =>
        error instanceof LynxPolicyError && error.policyId === "output-policy",
    );
  });
  await tracer.shutdown();

  const evaluations = telemetry.filter(
    (event) => event.eventType === "POLICY_EVALUATION",
  );
  assert.equal(evaluations.length, 2);
  assert.deepEqual(
    evaluations.map((event) => event.payload.phase),
    ["INPUT", "OUTPUT"],
  );
  const violations = telemetry.filter(
    (event) => event.eventType === "POLICY_VIOLATION",
  );
  assert.deepEqual(violations[0].payload.input, { redacted: true });
  assert.equal(violations[1].payload.output, "이 답변은 차단 대상입니다.");
});

test("managed policies can match nested tool input without evaluating JavaScript", async () => {
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/runtime-config")) {
      return new Response(
        JSON.stringify({
          revision: "policy-revision-2",
          prompts: [],
          policies: [
            {
              policyId: "18",
              name: "Refund limit",
              description: null,
              version: "v1",
              condition: "input.amount > 100",
              severity: "HIGH",
              action: "BLOCK",
            },
          ],
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  const tracer = createTracer({ runtimeConfig: { enabled: true } });
  const refund = tracer.firewallTool("refund", async ({ amount }) => amount, {
    riskLevel: "HIGH",
  });

  await assert.rejects(() =>
    tracer.run("SupportAgent", () => refund({ amount: 500 })),
  );
  await tracer.shutdown();
});

test("managed policies support boolean groups and run-local state", async () => {
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/runtime-config")) {
      return new Response(
        JSON.stringify({
          revision: "state-policy-1",
          prompts: [],
          policies: [
            {
              policyId: "19",
              name: "Repeated critical refund",
              description: null,
              version: "v1",
              condition:
                "(tool.riskLevel == 'CRITICAL' AND state.callCount >= 2) OR state.totalCost > 10",
              severity: "CRITICAL",
              action: "BLOCK",
            },
          ],
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  const tracer = createTracer({ runtimeConfig: { enabled: true } });
  const refund = tracer.firewallTool("refund", async ({ amount }) => amount, {
    riskLevel: "CRITICAL",
  });

  await tracer.run("SupportAgent", async () => {
    assert.equal(await refund({ amount: 10 }), 10);
    await assert.rejects(() => refund({ amount: 20 }), LynxPolicyError);
  });
  await tracer.shutdown();
});

test("an approved REQUIRE_APPROVAL decision resumes the original tool call", async () => {
  let approvalPolls = 0;
  globalThis.fetch = async (url, init) => {
    const path = String(url);
    if (path.endsWith("/runtime-config")) {
      return new Response(
        JSON.stringify({
          revision: "approval-policy-1",
          prompts: [],
          policies: [
            {
              policyId: "20",
              name: "Approve external write",
              description: "Operator approval required.",
              version: "v1",
              condition: "tool.sideEffect == true",
              severity: "HIGH",
              action: "REQUIRE_APPROVAL",
            },
          ],
        }),
        { status: 200 },
      );
    }
    if (path.endsWith("/firewall-approvals") && init.method === "POST") {
      return new Response(
        JSON.stringify({
          id: "8c6e30bd-e743-4bc3-b430-074184c9c887",
          status: "PENDING",
          expiresAt: "2026-07-25T12:00:00.000Z",
          decidedAt: null,
          decisionReason: null,
        }),
        { status: 201 },
      );
    }
    if (path.includes("/firewall-approvals/")) {
      approvalPolls += 1;
      return new Response(
        JSON.stringify({
          id: "8c6e30bd-e743-4bc3-b430-074184c9c887",
          status: "APPROVED",
          expiresAt: "2026-07-25T12:00:00.000Z",
          decidedAt: "2026-07-25T11:00:00.000Z",
          decisionReason: "Approved by operator.",
        }),
        { status: 200 },
      );
    }
    if (path.endsWith("/issue-records")) {
      return new Response(
        JSON.stringify({
          recordId: "4acb9bfb-36c7-49bc-bd69-13a930cff154",
          status: "RECEIVED",
          isNew: true,
        }),
        { status: 202 },
      );
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  const tracer = createTracer({
    runtimeConfig: { enabled: true },
    approval: { enabled: true, pollIntervalMs: 1, timeoutMs: 1_000 },
  });
  const write = tracer.firewallTool("external.write", async () => "completed", {
    sideEffect: true,
    riskLevel: "HIGH",
  });

  const result = await tracer.run("SupportAgent", () => write({ value: 1 }));
  await tracer.shutdown();

  assert.equal(result, "completed");
  assert.equal(approvalPolls, 1);
});

test("a tampered signed runtime bundle is rejected", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const prompts = [prompt("v1", "Signed prompt")];
  const policies = [];
  const revision = "signed-revision-1";
  const signature = signPayload(
    null,
    Buffer.from(JSON.stringify({ revision, prompts, policies })),
    privateKey,
  ).toString("base64url");
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        revision,
        prompts: [{ ...prompts[0], content: "Tampered prompt" }],
        policies,
        signing: { algorithm: "Ed25519", keyId: "test", signature },
      }),
      { status: 200 },
    );
  const tracer = createTracer({
    runtimeConfig: {
      enabled: false,
      requireSignature: true,
      signaturePublicKey: publicKey.export({
        type: "spki",
        format: "pem",
      }),
    },
  });

  await assert.rejects(
    () => tracer.getPrompt("support-agent"),
    /integrity check|signature verification/,
  );
  await tracer.shutdown();
});

test("the first loop threshold crossing submits one issue record", async () => {
  const issueRecords = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/issue-records")) {
      issueRecords.push(JSON.parse(init.body));
      return new Response(
        JSON.stringify({
          recordId: "4acb9bfb-36c7-49bc-bd69-13a930cff154",
          status: "RECEIVED",
          isNew: true,
        }),
        { status: 202 },
      );
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  const tracer = createTracer({
    issueReporting: { enabled: true },
  });
  const repeatedTool = tracer.instrumentTool("repeat", async () => "ok");

  await tracer.run("LoopingAgent", async () => {
    for (let index = 0; index < 6; index += 1) {
      await repeatedTool({ same: true });
    }
  });
  await tracer.shutdown();

  assert.equal(issueRecords.length, 1);
  assert.equal(issueRecords[0].detectionType, "LOOP_DETECTED");
  assert.equal(issueRecords[0].payload.loopCount, 5);
});

test("issue reporting failure does not fail an allowed tool call", async () => {
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/issue-records")) {
      throw new Error("issue endpoint unavailable");
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  const tracer = createTracer({
    issueReporting: { enabled: true, maxAttempts: 2 },
  });
  const warnedTool = tracer.firewallTool(
    "external-search",
    async () => "result",
    {
      riskLevel: "LOW",
      beforeCall: () => ({
        action: "WARN",
        policyId: "warning-policy",
      }),
    },
  );

  await assert.doesNotReject(async () => {
    const result = await tracer.run("SupportAgent", () => warnedTool({}));
    assert.equal(result, "result");
  });
  await tracer.shutdown();
});
