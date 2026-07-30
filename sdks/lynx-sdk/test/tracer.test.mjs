import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { LynxPolicyError, LynxTracer } from "../dist/index.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function createTracer(overrides = {}) {
  return new LynxTracer({
    clientId: "test-client",
    endpoint: "http://lynx.test",
    apiKey: "test-api-key",
    delivery: {
      flushIntervalMs: 60_000,
    },
    ...overrides,
  });
}

test("flush sends queued events even when the batch size is not reached", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer({
    delivery: { batchSize: 50, flushIntervalMs: 60_000 },
  });
  await tracer.run("SupportAgent", async () => {
    tracer.log("decision", { reason: "selected refund workflow" });
  });
  await tracer.flush();

  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 4);
  assert.deepEqual(
    batches[0].map((event) => event.eventType),
    ["CONTEXT_ALERT", "CONTEXT_ALERT", "CONTEXT_ALERT", "SESSION_OUTCOME"],
  );
  assert.equal(batches[0][3].payload.status, "COMPLETED");
  assert.equal(batches[0][3].payload.automatic, true);
});

test("uses the hosted Lynx API endpoint by default", async () => {
  let requestedUrl;
  globalThis.fetch = async (url) => {
    requestedUrl = url;
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = new LynxTracer({
    clientId: "test-client",
    apiKey: "test-api-key",
    delivery: {
      flushIntervalMs: 60_000,
    },
  });

  await tracer.run("SupportAgent", async () => {
    tracer.log("manual-note", { ok: true });
  });
  await tracer.flush();
  await tracer.shutdown();

  assert.equal(requestedUrl, "https://api.lynxops.co/openapi/v1/events/batch");
});

test("keeps agentId as a string and rejects unsafe values", async () => {
  const tracer = createTracer({ agentId: "orbit-assistant" });
  await assert.rejects(
    tracer.run(
      { agentName: "OrbitAssistant", agentId: "orbit\nassistant" },
      async () => {},
    ),
    /agentId must not contain control characters/,
  );
  await tracer.shutdown();

  assert.throws(
    () => createTracer({ agentId: " orbit-assistant " }),
    /agentId must not have leading or trailing whitespace/,
  );
  assert.throws(
    () => createTracer({ agentId: "orbit\nassistant" }),
    /agentId must not contain control characters/,
  );
});

test("sends API keys only through X-API-Key", async () => {
  let requestedHeaders;
  globalThis.fetch = async (_url, init) => {
    requestedHeaders = init.headers;
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer();
  await tracer.run("SupportAgent", async () => {
    tracer.log("manual-note", { ok: true });
  });
  await tracer.shutdown();

  assert.equal(requestedHeaders["X-API-Key"], "test-api-key");
  assert.equal(requestedHeaders.Authorization, undefined);
});

test("flush splits the queue into bounded batches", async () => {
  const batchSizes = [];
  globalThis.fetch = async (_url, init) => {
    batchSizes.push(JSON.parse(init.body).length);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer({
    delivery: { batchSize: 2, flushIntervalMs: 60_000 },
  });
  await tracer.run("SupportAgent", async () => {
    tracer.log("one", {});
    tracer.log("two", {});
    tracer.log("three", {});
  });
  await tracer.flush();
  await tracer.shutdown();

  assert.deepEqual(batchSizes, [2, 2, 2]);
});

test("shutdown flushes queued events and clears the timer", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer({
    delivery: { batchSize: 50, flushIntervalMs: 60_000 },
  });
  await tracer.run("SupportAgent", async () => {
    tracer.log("manual-note", { ok: true });
  });
  await tracer.shutdown();
  await tracer.shutdown();

  assert.equal(batches.length, 1);
});

test("default background delivery keeps telemetry out of the run response path", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer({
    delivery: { batchSize: 50, flushIntervalMs: 60_000 },
  });
  await tracer.run("SupportAgent", async () => {
    tracer.log("manual-note", { ok: true });
  });

  assert.equal(batches.length, 0);
  await tracer.shutdown();
  assert.equal(batches.length, 1);
});

test("background mode does not start HTTP delivery from run", async () => {
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer({
    delivery: { mode: "BACKGROUND", batchSize: 50, flushIntervalMs: 60_000 },
  });
  await tracer.run("SupportAgent", async () => {
    tracer.log("manual-note", { ok: true });
  });

  assert.equal(fetchCount, 0);
  await tracer.flush();
  assert.equal(fetchCount, 1);
  await tracer.shutdown();
});

test("delivery.timeoutMs is passed to telemetry requests", async () => {
  let signal;
  globalThis.fetch = async (_url, init) => {
    signal = init.signal;
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer({
    delivery: { timeoutMs: 25, flushIntervalMs: 60_000 },
  });
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
    delivery: {
      batchSize: 50,
      flushOnRunEnd: true,
      flushIntervalMs: 60_000,
    },
    circuitBreaker: {
      failureThreshold: 1,
      cooldownMs: 60_000,
    },
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

test("partial batch responses retry only retryable event ids on the next flush", async () => {
  const requests = [];
  globalThis.fetch = async (_url, init) => {
    const events = JSON.parse(init.body);
    requests.push(events);
    if (requests.length === 1) {
      return new Response(
        JSON.stringify({
          success: false,
          retryableEventIds: [events[0].eventId],
          rejectedEventIds: events.slice(1).map((event) => event.eventId),
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer({
    delivery: { batchSize: 50, flushIntervalMs: 60_000 },
  });
  await tracer.run("SupportAgent", () => {
    tracer.log("manual-note", {});
  });

  await tracer.flush();
  assert.equal(requests.length, 1);
  assert.equal(tracer.getStatus().queueSize, 1);

  await tracer.flush();
  assert.equal(requests.length, 2);
  assert.equal(requests[1].length, 1);
  assert.equal(requests[1][0].eventId, requests[0][0].eventId);
  await tracer.shutdown();
});

test("parallel runs keep AsyncLocalStorage contexts isolated", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer({
    captureMode: "full",
    delivery: { batchSize: 100, flushIntervalMs: 60_000 },
  });
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

test("instrumentTool preserves synchronous returns and caller this", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer({
    captureMode: "full",
    delivery: { batchSize: 100, flushIntervalMs: 60_000 },
  });
  const calculator = {
    base: 2,
    add: tracer.instrumentTool("calculator.add", function (value) {
      return this.base + value;
    }),
  };

  let result;
  await tracer.run("SupportAgent", () => {
    result = calculator.add(3);
  });
  await tracer.shutdown();

  assert.equal(result, 5);
  assert.equal(result instanceof Promise, false);
  assert.ok(
    batches
      .flat()
      .some(
        (event) =>
          event.eventType === "TOOL_RESULT" && event.payload.output === 5,
      ),
  );
});

test("nested instrumented tools inherit the outer tool span", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer({
    delivery: { batchSize: 100, flushIntervalMs: 60_000 },
  });
  const innerTool = tracer.instrumentTool("inner-tool", () => "done");
  const outerTool = tracer.instrumentTool("outer-tool", () => innerTool());

  await tracer.run("SupportAgent", () => outerTool());
  await tracer.shutdown();

  const events = batches.flat();
  const outerStart = events.find(
    (event) =>
      event.eventType === "TOOL_CALL" &&
      event.payload.toolName === "outer-tool",
  );
  const innerStart = events.find(
    (event) =>
      event.eventType === "TOOL_CALL" &&
      event.payload.toolName === "inner-tool",
  );

  assert.ok(outerStart);
  assert.ok(innerStart);
  assert.equal(innerStart.payload.parentSpanId, outerStart.payload.spanId);
});

test("delivery queue drops oldest events when maxQueueSize is reached", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer({
    delivery: {
      batchSize: 100,
      flushIntervalMs: 60_000,
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
  assert.deepEqual(labels, ["fourth"]);
});

test("setAttributes attaches metadata to subsequent events only", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer({
    delivery: { batchSize: 100, flushIntervalMs: 60_000 },
  });
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

test("firewallTool supports action decisions and input shortcut", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer({ captureMode: "full" });
  const refund = tracer.firewallTool(
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
    (error) => {
      assert.ok(error instanceof LynxPolicyError);
      assert.equal(error.action, "BLOCK");
      assert.equal(error.policyId, "refund-limit");
      assert.match(error.message, /Refund amount is over the limit/);
      return true;
    },
  );
  await tracer.shutdown();

  const policy = batches
    .flat()
    .find((event) => event.eventType === "POLICY_EVALUATION");
  assert.equal(policy.payload.action, "BLOCK");
  assert.equal(policy.payload.input.amount, 500);
});

test("getStatus reports queue and circuit breaker state", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ success: false }), { status: 200 });

  const tracer = createTracer({
    delivery: {
      batchSize: 50,
      flushIntervalMs: 60_000,
    },
    circuitBreaker: {
      failureThreshold: 1,
      cooldownMs: 60_000,
    },
  });

  await tracer.run("SupportAgent", async () => {
    tracer.log("manual-note", { ok: false });
  });
  await tracer.flush();

  const status = tracer.getStatus();
  assert.equal(status.queueSize, 4);
  assert.equal(status.circuitState, "OPEN");
  assert.equal(status.lastError, "batch_failed");
  await tracer.shutdown({ timeoutMs: 20 });
});

test("shutdown can return after the configured timeout", async () => {
  globalThis.fetch = async () => new Promise(() => {});

  const tracer = createTracer({
    delivery: {
      batchSize: 50,
      flushIntervalMs: 60_000,
    },
  });

  await tracer.run("SupportAgent", async () => {
    tracer.log("manual-note", { ok: true });
  });

  const start = Date.now();
  await tracer.shutdown({ timeoutMs: 20 });
  assert.equal(Date.now() - start < 500, true);
});

test("concurrent shutdown callers keep their own timeout", async () => {
  globalThis.fetch = async () => new Promise(() => {});

  const tracer = createTracer({
    delivery: {
      batchSize: 50,
      flushIntervalMs: 60_000,
    },
  });
  await tracer.run("SupportAgent", () => {
    tracer.log("manual-note", { ok: true });
  });

  const start = Date.now();
  await Promise.all([
    tracer.shutdown({ timeoutMs: 10 }),
    tracer.shutdown({ timeoutMs: 20 }),
  ]);

  assert.equal(Date.now() - start < 500, true);
});

test("events captured after shutdown are rejected instead of stranded", async () => {
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer({
    delivery: {
      batchSize: 50,
      flushIntervalMs: 60_000,
    },
  });
  await tracer.run("SupportAgent", () => {
    tracer.log("before-shutdown", {});
  });
  await tracer.shutdown();

  await tracer.run("SupportAgent", () => {
    tracer.log("after-shutdown", {});
  });
  await tracer.flush();

  assert.equal(fetchCount, 1);
  assert.equal(tracer.getStatus().queueSize, 0);
  assert.equal(tracer.getStatus().droppedEvents, 4);
});

test("firewallTool applies failureMode when policy evaluation throws", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer();
  const riskyTool = tracer.firewallTool(
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
  const outcomes = events.filter(
    (event) => event.eventType === "SESSION_OUTCOME",
  );
  const outcome = outcomes[0];
  assert.equal(outcomes.length, 1);
  assert.equal(outcome.payload.businessStatus, "FAILED");
  assert.equal(outcome.payload.automatic, undefined);
  assert.equal(outcome.payload.appVersion, "1.2.3");
  assert.equal(outcome.payload.deploymentId, "deploy-7");
  assert.equal(outcome.payload.environment, "test");
  assert.equal(outcome.payload.policyVersion, "policy-1");
});

test("run records one automatic failed outcome when execution throws", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer();
  await assert.rejects(
    () =>
      tracer.run("SupportAgent", async () => {
        throw new Error("provider failed");
      }),
    /provider failed/,
  );
  await tracer.shutdown();

  const outcomes = batches
    .flat()
    .filter((event) => event.eventType === "SESSION_OUTCOME");
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].payload.status, "FAILED");
  assert.equal(outcomes[0].payload.automatic, true);
  assert.equal(outcomes[0].payload.error, "provider failed");
});

test("an explicit outcome in a child run suppresses the root automatic outcome", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer();
  await tracer.run("RootAgent", async () => {
    await tracer.run("ChildAgent", async () => {
      tracer.outcome({
        status: "COMPLETED",
        businessStatus: "SUCCEEDED",
      });
    });
  });
  await tracer.shutdown();

  const outcomes = batches
    .flat()
    .filter((event) => event.eventType === "SESSION_OUTCOME");
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].payload.automatic, undefined);
});

test("instrumentLLM captures OpenAI Responses API calls", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer();
  const client = tracer.instrumentLLM({
    responses: {
      create: async (input) => ({
        id: "resp_123",
        output_text: `answer: ${input.input}`,
        usage: {
          input_tokens: 12,
          output_tokens: 8,
          total_tokens: 20,
        },
      }),
    },
  });

  await tracer.run("SupportAgent", async () => {
    const result = await client.responses.create({
      model: "gpt-4.1-mini",
      input: "Summarize this ticket",
      promptVersion: "support-summary-v3",
    });

    assert.equal(result.output_text, "answer: Summarize this ticket");
  });
  await tracer.shutdown();

  const llmEvents = batches
    .flat()
    .filter((event) => event.eventType === "LLM_CALL");

  assert.equal(llmEvents.length, 2);
  assert.equal(llmEvents[0].payload.path, "responses.create");
  assert.equal(llmEvents[0].payload.model, "gpt-4.1-mini");
  assert.equal(llmEvents[0].payload.promptVersion, "support-summary-v3");
  assert.equal(llmEvents[1].payload.phase, "end");
  assert.equal(llmEvents[1].payload.usage.totalTokens, 20);
});

test("instrumentLLM captures a directly wrapped provider function", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer();
  const callProvider = tracer.instrumentLLM(
    async (input) => ({
      text: "hello",
      usage: {
        promptTokens: input.promptTokens,
        completionTokens: 8,
        totalTokens: input.promptTokens + 8,
      },
    }),
    {
      modelLabel: "custom.provider.generate",
      customRule: {
        extractInput: ([input]) => input,
        extractOutput: (result) => ({ text: result.text }),
        extractUsage: (result) => result.usage,
        estimateCost: (_model, promptTokens, completionTokens) =>
          (promptTokens + completionTokens) / 1_000,
      },
    },
  );

  await tracer.run("SupportAgent", async () => {
    await callProvider({
      provider: "openai",
      model: "gpt-4.1-mini",
      promptTokens: 12,
    });
  });
  await tracer.shutdown();

  const llmEvents = batches
    .flat()
    .filter((event) => event.eventType === "LLM_CALL");
  assert.equal(llmEvents.length, 2);
  assert.equal(llmEvents[0].payload.path, "call");
  assert.equal(llmEvents[1].payload.model, "gpt-4.1-mini");
  assert.equal(llmEvents[1].payload.usage.totalTokens, 20);
  assert.equal(llmEvents[1].payload.cost, 0.02);
  assert.equal(llmEvents[1].payload.costSource, "CLIENT_ESTIMATED");
});

test("instrumentLLM closes streaming spans after iteration completes", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer();
  const client = tracer.instrumentLLM({
    async streamText() {
      return (async function* () {
        yield "hello";
        await new Promise((resolve) => setTimeout(resolve, 5));
        yield " world";
      })();
    },
  });

  await tracer.run("SupportAgent", async () => {
    const chunks = [];
    for await (const chunk of await client.streamText({
      model: "test-model",
    })) {
      chunks.push(chunk);
    }
    assert.equal(chunks.join(""), "hello world");
  });
  await tracer.shutdown();

  const llmEvents = batches
    .flat()
    .filter((event) => event.eventType === "LLM_CALL");
  assert.deepEqual(
    llmEvents.map((event) => event.payload.phase),
    ["start", "end"],
  );
  assert.equal(llmEvents[1].payload.spanId, llmEvents[0].payload.spanId);
  assert.equal(llmEvents[1].payload.latency >= 5, true);
});

test("instrumentTool captures tool call metadata and result summary", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer();
  const lookupOrder = tracer.instrumentTool(
    "orders.lookup",
    async ({ orderId }) => ({ orderId, status: "paid" }),
    {
      sideEffect: false,
      riskLevel: "LOW",
      externalTarget: "orders-api",
      toolVersion: "2026-06-29",
    },
  );

  await tracer.run("SupportAgent", async () => {
    const result = await lookupOrder({ orderId: "order_123" });
    assert.equal(result.status, "paid");
  });
  await tracer.shutdown();

  const events = batches.flat();
  const call = events.find((event) => event.eventType === "TOOL_CALL");
  const result = events.find((event) => event.eventType === "TOOL_RESULT");

  assert.equal(call.label, "orders.lookup");
  assert.equal(call.payload.externalTarget, "orders-api");
  assert.equal(call.payload.toolVersion, "2026-06-29");
  assert.equal(result.payload.toolName, "orders.lookup");
  assert.match(result.payload.resultSummary, /order_123/);
});

test("firewallTool records policy events and blocks unsafe calls", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  const tracer = createTracer();
  const refund = tracer.firewallTool(
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
  assert.ok(events.some((event) => event.eventType === "FIREWALL_ACTIVATED"));
  assert.equal(
    events.some((event) => event.eventType === "TOOL_RESULT"),
    false,
  );
});

test("uses canonical SHA-256 hashes for equivalent tool inputs", async () => {
  const batches = [];
  globalThis.fetch = async (_url, init) => {
    batches.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  const tracer = createTracer({
    delivery: { batchSize: 100, flushIntervalMs: 60_000 },
  });
  const tool = tracer.instrumentTool("canonical-input", async () => "ok");

  await tracer.run("HashAgent", async () => {
    await tool({ first: 1, second: 2 });
    await tool({ second: 2, first: 1 });
  });
  await tracer.shutdown();

  const hashes = batches
    .flat()
    .filter((event) => event.eventType === "TOOL_CALL")
    .map((event) => event.payload.argsHash);
  assert.equal(hashes.length, 2);
  assert.equal(hashes[0].length, 64);
  assert.equal(hashes[0], hashes[1]);
});

test("sampling never disables loop issue detection", async () => {
  const issueRecords = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/issue-records")) {
      issueRecords.push(JSON.parse(init.body));
      return new Response(
        JSON.stringify({
          recordId: "0fa018de-b66c-409c-b553-bf4230d92eef",
          status: "RECEIVED",
          isNew: true,
        }),
        { status: 202 },
      );
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  const tracer = createTracer({
    sampleRate: 0,
    issueReporting: { enabled: true },
  });
  const repeated = tracer.instrumentTool("sampled-loop", async () => "ok");

  await tracer.run("SampledAgent", async () => {
    for (let index = 0; index < 5; index += 1) {
      await repeated({ stable: true });
    }
  });
  await tracer.shutdown();

  assert.equal(issueRecords.length, 1);
  assert.equal(issueRecords[0].detectionType, "LOOP_DETECTED");
});

test("reports recovery after consecutive healthy policy observations", async () => {
  const issueRecords = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/issue-records")) {
      issueRecords.push(JSON.parse(init.body));
      return new Response(
        JSON.stringify({
          recordId:
            issueRecords.length === 1
              ? "fece671f-18b1-4400-8ed1-0097cc56e878"
              : "73c49289-2ec8-4209-9916-86e4fce23857",
          status: "RECEIVED",
          isNew: true,
        }),
        { status: 202 },
      );
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  let shouldBlock = true;
  const tracer = createTracer({
    issueReporting: {
      enabled: true,
      recoverySuccessThreshold: 3,
    },
  });
  const guarded = tracer.firewallTool(
    "recoverable-tool",
    async () => "ok",
    {
      beforeCall: () => ({
        action: shouldBlock ? "BLOCK" : "ALLOW",
        policyId: shouldBlock ? "recoverable-policy" : undefined,
      }),
    },
  );

  await assert.rejects(() =>
    tracer.run("RecoveryAgent", () => guarded({ stable: true })),
  );
  shouldBlock = false;
  for (let index = 0; index < 3; index += 1) {
    await tracer.run("RecoveryAgent", () => guarded({ stable: true }));
  }
  await tracer.shutdown();

  assert.deepEqual(
    issueRecords.map((record) => record.recordKind),
    ["DETECTION", "RECOVERY"],
  );
  assert.equal(issueRecords[1].payload.healthyObservationCount, 3);
});

test("exposes permanent issue reporting failures without retrying them", async () => {
  let issueRequestCount = 0;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/issue-records")) {
      issueRequestCount += 1;
      return new Response("unauthorized", { status: 401 });
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  const tracer = createTracer({
    issueReporting: { enabled: true, maxAttempts: 5 },
  });
  const warned = tracer.firewallTool("warned-tool", async () => "ok", {
    beforeCall: () => ({ action: "WARN", policyId: "warn-policy" }),
  });

  await tracer.run("StatusAgent", () => warned({ value: 1 }));
  await tracer.shutdown();

  const status = tracer.getStatus().issueReporting;
  assert.equal(issueRequestCount, 1);
  assert.equal(status.permanentlyRejectedRecords, 1);
  assert.equal(status.queueSize, 0);
  assert.equal(status.lastError, "http_401");
});
