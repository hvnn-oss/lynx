import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { LynxTracer } from "../dist/index.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function createTracer(overrides = {}) {
  return new LynxTracer({
    clientId: "test-client",
    lynxCloudUrl: "http://lynx.test",
    apiKey: "test-api-key",
    flushIntervalMs: 60_000,
    ...overrides,
  });
}

test("run flushes queued events even when the batch size is not reached", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer({ batchSize: 50 });
  await tracer.run("SupportAgent", async () => {
    tracer.log("decision", { reason: "selected refund workflow" });
  });
  await tracer.shutdown();

  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 3);
  assert.deepEqual(
    batches[0].map((event) => event.payload.phase),
    ["start", undefined, "end"],
  );
});

test("shutdown flushes queued events and clears the timer", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer({ batchSize: 50 });
  await tracer.run("SupportAgent", async () => {
    tracer.log("manual-note", { ok: true });
  });
  await tracer.shutdown();
  await tracer.shutdown();

  assert.equal(batches.length, 1);
});

test("flushOnRunEnd=false keeps telemetry out of the run response path", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer({ batchSize: 50, flushOnRunEnd: false });
  await tracer.run("SupportAgent", async () => {
    tracer.log("manual-note", { ok: true });
  });

  assert.equal(batches.length, 0);
  await tracer.shutdown();
  assert.equal(batches.length, 1);
});

test("backgroundOnly=true does not wait for telemetry delivery after run", async () => {
  let resolveFetch;
  let fetchStarted = false;
  globalThis.fetch = async () => {
    fetchStarted = true;
    return new Promise((resolve) => {
      resolveFetch = () =>
        resolve(
          new Response(JSON.stringify({ success: true }), { status: 200 }),
        );
    });
  };

  const tracer = createTracer({ batchSize: 50, backgroundOnly: true });
  await tracer.run("SupportAgent", async () => {
    tracer.log("manual-note", { ok: true });
  });

  assert.equal(fetchStarted, true);
  resolveFetch();
  await tracer.shutdown();
});

test("requestTimeoutMs is passed to telemetry requests", async () => {
  let signal;
  globalThis.fetch = async (_url, init) => {
    signal = init.signal;
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer({ requestTimeoutMs: 25 });
  await tracer.run("SupportAgent", async () => {
    tracer.log("manual-note", { ok: true });
  });
  await tracer.shutdown();

  assert.ok(signal instanceof AbortSignal);
});

test("circuit breaker skips immediate telemetry retries after failures", async () => {
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return new Response(JSON.stringify({ success: false }), { status: 200 });
  };

  const tracer = createTracer({
    batchSize: 50,
    circuitBreakerFailureThreshold: 1,
    circuitBreakerCooldownMs: 60_000,
  });

  await tracer.run("SupportAgent", async () => {
    tracer.log("first", { ok: false });
  });
  await tracer.run("SupportAgent", async () => {
    tracer.log("second", { ok: false });
  });
  await tracer.shutdown();

  assert.equal(fetchCount, 1);
});

test("parallel runs keep AsyncLocalStorage contexts isolated", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer({ batchSize: 100, flushOnRunEnd: false });
  await Promise.all([
    tracer.run(
      { agentName: "SupportAgent", sessionId: "session-A" },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        tracer.decision("A decision");
      },
    ),
    tracer.run(
      { agentName: "SupportAgent", sessionId: "session-B" },
      async () => {
        tracer.decision("B decision");
      },
    ),
  ]);
  await tracer.shutdown();

  const events = batches.flat();
  const decisionA = events.find(
    (event) => event.payload.reason === "A decision",
  );
  const decisionB = events.find(
    (event) => event.payload.reason === "B decision",
  );
  assert.equal(decisionA.sessionId, "session-A");
  assert.equal(decisionB.sessionId, "session-B");
});

test("delivery queue drops oldest events when maxQueueSize is reached", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer({
    batchSize: 100,
    flushOnRunEnd: false,
    delivery: {
      maxQueueSize: 3,
      overflowStrategy: "DROP_OLDEST",
    },
  });

  await tracer.run("SupportAgent", async () => {
    tracer.log("first", { index: 1 });
    tracer.log("second", { index: 2 });
    tracer.log("third", { index: 3 });
    tracer.log("fourth", { index: 4 });
  });
  await tracer.shutdown();

  const labels = batches
    .flat()
    .map((event) => event.label)
    .filter((label) => ["first", "second", "third", "fourth"].includes(label));
  assert.deepEqual(labels, ["third", "fourth"]);
});

test("setAttributes attaches metadata to subsequent events only", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer({ batchSize: 100, flushOnRunEnd: false });
  await tracer.run("SupportAgent", async () => {
    tracer.log("before", { ok: true });
    tracer.setAttributes({ orderId: "order-1" });
    tracer.log("after", { ok: true });
  });
  await tracer.shutdown();

  const events = batches.flat();
  assert.equal(
    events.find((event) => event.label === "before").payload.orderId,
    undefined,
  );
  assert.equal(
    events.find((event) => event.label === "after").payload.orderId,
    "order-1",
  );
});

test("guardTool supports action decisions and input shortcut", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer();
  const refund = tracer.guardTool(
    "refund",
    async ({ amount }) => ({ refunded: amount }),
    {
      riskLevel: "HIGH",
      beforeCall: ({ input }) => ({
        action: input.amount <= 100 ? "ALLOW" : "BLOCK",
        policyId: "refund-limit",
        reason: "Refund amount is over the limit",
      }),
    },
  );

  await assert.rejects(
    () => tracer.run("SupportAgent", () => refund({ amount: 500 })),
    /Refund amount is over the limit/,
  );
  await tracer.shutdown();

  const policy = batches
    .flat()
    .find((event) => event.eventType === "POLICY_EVALUATION");
  assert.equal(policy.payload.action, "BLOCK");
  assert.equal(policy.payload.input.amount, 500);
});

test("guardTool applies failureMode when policy evaluation throws", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer();
  const riskyTool = tracer.guardTool(
    "wireTransfer",
    async () => ({ ok: true }),
    {
      riskLevel: "HIGH",
      failureMode: "FAIL_CLOSED",
      beforeCall: () => {
        throw new Error("policy service unavailable");
      },
    },
  );

  await assert.rejects(
    () => tracer.run("SupportAgent", () => riskyTool({ amount: 500 })),
    /policy service unavailable/,
  );
  await tracer.shutdown();

  const policy = batches
    .flat()
    .find((event) => event.eventType === "POLICY_EVALUATION");
  assert.equal(policy.payload.action, "BLOCK");
  assert.equal(policy.payload.metadata.policyError, true);
  assert.equal(policy.payload.metadata.failureMode, "FAIL_CLOSED");
});

test("semantic APIs capture agent behavior and outcome events", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer({
    appVersion: "1.2.3",
    deploymentId: "deploy-7",
    environment: "test",
    policyVersion: "policy-1",
  });

  await tracer.run("SupportAgent", async () => {
    tracer.userInput("refund my last order", { userId: "usr-1" });
    tracer.decision("selected refund workflow", {
      candidates: ["refund", "faq"],
    });
    tracer.context({ orderId: "ord-1", refundWindowDays: 30 });
    tracer.memory("read", { key: "customer-tier", value: "gold" });
    tracer.outcome({
      status: "COMPLETED",
      businessStatus: "FAILED",
      reason: "Refund amount exceeded policy",
      userImpact: "HIGH",
    });
  });
  await tracer.shutdown();

  const events = batches.flat();
  assert.ok(events.some((event) => event.eventType === "USER_INPUT"));
  assert.ok(events.some((event) => event.eventType === "AGENT_DECISION"));
  assert.ok(events.some((event) => event.eventType === "CONTEXT_RETRIEVAL"));
  assert.ok(events.some((event) => event.eventType === "MEMORY_ACCESS"));
  const outcome = events.find((event) => event.eventType === "SESSION_OUTCOME");
  assert.equal(outcome.payload.businessStatus, "FAILED");
  assert.equal(outcome.payload.appVersion, "1.2.3");
  assert.equal(outcome.payload.deploymentId, "deploy-7");
  assert.equal(outcome.payload.environment, "test");
  assert.equal(outcome.payload.policyVersion, "policy-1");
});

test("guardTool records policy events and blocks unsafe calls", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer();
  const refund = tracer.guardTool(
    "refund",
    async ({ amount }) => ({ refunded: amount }),
    {
      riskLevel: "HIGH",
      sideEffect: true,
      beforeCall: ({ args }) => {
        const amount = args[0]?.amount ?? 0;
        return {
          allow: amount <= 100,
          policyId: "refund-limit",
          reason: "Refund amount is over the limit",
          severity: "HIGH",
        };
      },
    },
  );

  await assert.rejects(
    () => tracer.run("SupportAgent", () => refund({ amount: 500 })),
    /Refund amount is over the limit/,
  );
  await tracer.shutdown();

  const events = batches.flat();
  assert.ok(events.some((event) => event.eventType === "POLICY_EVALUATION"));
  assert.ok(events.some((event) => event.eventType === "POLICY_VIOLATION"));
  assert.ok(events.some((event) => event.eventType === "GUARDRAIL_ACTIVATED"));
  assert.equal(
    events.some((event) => event.eventType === "TOOL_RESULT"),
    false,
  );
});
