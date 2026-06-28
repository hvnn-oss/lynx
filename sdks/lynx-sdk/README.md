# Lynx SDK

TypeScript SDK for collecting AI agent telemetry and sending it to a Lynx server.

The SDK is designed for production AI services. Telemetry delivery errors do not stop the application by default. Events are queued in memory, sent in batches, retried with backoff, and protected by a circuit breaker.

## Install

```bash
pnpm add @repo/sdk
```

## Basic Usage

```ts
import { LynxTracer } from "@repo/sdk";

const lynx = new LynxTracer({
  clientId: "support-api",
  endpoint: "https://lynx.example.com",
  apiKey: process.env.LYNX_API_KEY,
});

await lynx.run("SupportAgent", async () => {
  lynx.userInput("I want a refund", { userId: "usr_123" });
  lynx.setAttributes({ orderId: "order_123" });
  lynx.context("refund-policy", { refundWindowDays: 30 });
  lynx.decision({
    name: "select_refund_workflow",
    selected: "refund",
    confidence: 0.82,
    reason: "Order is inside the refund window",
  });
});
```

## Production Delivery

These are the production-oriented defaults:

- `delivery.mode`: `"BACKGROUND"`
- `delivery.timeoutMs`: `1000`
- `delivery.flushOnRunEnd`: `false`
- `delivery.flushIntervalMs`: `3000`
- `delivery.batchSize`: `50`
- `circuitBreaker.enabled`: `true`
- `circuitBreaker.failureThreshold`: `3`
- `circuitBreaker.cooldownMs`: `30000`

```ts
const lynx = new LynxTracer({
  clientId: "support-api",
  endpoint: "https://lynx.example.com",
  apiKey: process.env.LYNX_API_KEY,

  delivery: {
    mode: "BACKGROUND",
    timeoutMs: 1000,
    flushOnRunEnd: false,
    flushIntervalMs: 5000,
    batchSize: 50,
    maxQueueSize: 10_000,
    overflowStrategy: "DROP_OLDEST",
  },

  circuitBreaker: {
    enabled: true,
    failureThreshold: 3,
    cooldownMs: 30_000,
  },
});
```

### Option Reference

| Option                            | Default        | Description                                                                                                  |
| --------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------ |
| `endpoint`                        | Required       | Lynx server URL.                                                                                             |
| `delivery.mode`                   | `"BACKGROUND"` | `"BACKGROUND"` keeps HTTP delivery out of `run()`; `"BLOCKING"` may flush when the batch size is reached.    |
| `delivery.timeoutMs`              | `1000`         | Maximum duration for one telemetry HTTP request.                                                             |
| `delivery.flushOnRunEnd`          | `false`        | When `true`, `run()` tries to flush after the wrapped agent work finishes.                                   |
| `delivery.flushIntervalMs`        | `3000`         | Background flush interval in milliseconds.                                                                   |
| `delivery.batchSize`              | `50`           | Number of newly queued events that can trigger a flush in blocking mode.                                     |
| `delivery.maxQueueSize`           | `1000`         | Maximum number of queued telemetry events kept in memory.                                                    |
| `delivery.overflowStrategy`       | `DROP_OLDEST`  | `DROP_OLDEST` keeps the newest events. `DROP_NEWEST` preserves the existing queue and drops incoming events. |
| `circuitBreaker.enabled`          | `true`         | Enables circuit breaker protection for telemetry delivery.                                                   |
| `circuitBreaker.failureThreshold` | `3`            | Number of consecutive failed sends before the breaker opens.                                                 |
| `circuitBreaker.cooldownMs`       | `30000`        | Time to wait before allowing another send attempt after the breaker opens.                                   |

## What Happens If the Lynx Server Is Down?

The AI service keeps running.

When delivery fails, the SDK:

- catches network, timeout, and non-2xx response errors
- stores events in an in-memory retry buffer
- applies exponential backoff
- opens the circuit breaker after repeated failures
- drops events according to `delivery.overflowStrategy` if the queue reaches `delivery.maxQueueSize`

With the defaults, `run()` only records telemetry locally. HTTP delivery happens from the background timer, explicit `flush()`, or `shutdown()`.

## Flush, Shutdown, and Status

Use `flush()` when you want to send the current queue and keep using the SDK.

```ts
await lynx.flush();
```

Use `shutdown()` when the process is about to exit, when a serverless handler ends, or in tests. It clears the SDK timer and waits for pending telemetry sends. Pass `timeoutMs` to avoid waiting indefinitely.

```ts
await lynx.shutdown({ timeoutMs: 1000 });
```

Use `getStatus()` for local diagnostics.

```ts
const status = lynx.getStatus();
console.log(status.circuitState, status.queueSize);
```

## Guardrails

`guardTool()` evaluates policy locally through your `beforeCall` callback. Lynx server availability does not decide whether the tool is blocked.

```ts
import { LynxPolicyError } from "@repo/sdk";

const refund = lynx.guardTool(
  "refund",
  async ({ amount }: { amount: number }) => ({ refunded: amount }),
  {
    riskLevel: "HIGH",
    sideEffect: true,
    failureMode: "FAIL_CLOSED",
    beforeCall: ({ input }) => ({
      action: input.amount <= 100 ? "ALLOW" : "BLOCK",
      policyId: "refund-limit",
      reason: "Refund amount is over the limit",
      severity: "HIGH",
    }),
  },
);

try {
  await lynx.run("SupportAgent", () => refund({ amount: 500 }));
} catch (error) {
  if (error instanceof LynxPolicyError) {
    console.log(error.action, error.policyId, error.reason);
  }
}
```

If `beforeCall` returns `action: "BLOCK"` or `action: "REQUIRE_APPROVAL"`, the SDK blocks the tool call and records policy events. If the Lynx server is unavailable, those events are retried later, but the local block still happens.

If policy evaluation itself throws, `failureMode` decides what to do:

| Failure Mode       | Behavior                                     |
| ------------------ | -------------------------------------------- |
| `FAIL_OPEN`        | Allow the tool call and record policy error. |
| `FAIL_CLOSED`      | Block the tool call.                         |
| `REQUIRE_APPROVAL` | Block with `action: "REQUIRE_APPROVAL"`.     |

## Environment Variables

The default `lynx` export reads these environment variables:

| Variable                                 | Description                                           |
| ---------------------------------------- | ----------------------------------------------------- |
| `LYNX_CLIENT_ID`                         | Client or service identifier.                         |
| `LYNX_ENDPOINT`                          | Lynx server URL.                                      |
| `LYNX_API_KEY`                           | API key used for ingestion.                           |
| `LYNX_WORKSPACE_ID`                      | Default workspace id.                                 |
| `LYNX_AGENT_ID`                          | Default agent id.                                     |
| `LYNX_SAMPLE_RATE`                       | Sampling rate from `0` to `1`.                        |
| `LYNX_CAPTURE_INPUT`                     | Whether to capture inputs.                            |
| `LYNX_CAPTURE_OUTPUT`                    | Whether to capture outputs.                           |
| `LYNX_CAPTURE_MODE`                      | `full`, `metadata-only`, or `smart`.                  |
| `LYNX_MAX_PAYLOAD_LENGTH`                | Maximum payload string length.                        |
| `LYNX_APP_VERSION`                       | Application version metadata.                         |
| `LYNX_DEPLOYMENT_ID`                     | Deployment id metadata.                               |
| `LYNX_ENVIRONMENT`                       | Runtime environment metadata.                         |
| `LYNX_POLICY_VERSION`                    | Policy version metadata.                              |
| `LYNX_DELIVERY_MODE`                     | `BLOCKING` or `BACKGROUND`.                           |
| `LYNX_DELIVERY_TIMEOUT_MS`               | Delivery timeout in milliseconds.                     |
| `LYNX_DELIVERY_FLUSH_ON_RUN_END`         | `true` or `false`.                                    |
| `LYNX_DELIVERY_FLUSH_INTERVAL_MS`        | Flush interval in milliseconds.                       |
| `LYNX_DELIVERY_BATCH_SIZE`               | Batch size for blocking-mode flush triggers.          |
| `LYNX_DELIVERY_MAX_QUEUE_SIZE`           | Maximum queued event count.                           |
| `LYNX_DELIVERY_OVERFLOW_STRATEGY`        | `DROP_OLDEST` or `DROP_NEWEST`.                       |
| `LYNX_CIRCUIT_BREAKER_ENABLED`           | `true` or `false`.                                    |
| `LYNX_CIRCUIT_BREAKER_FAILURE_THRESHOLD` | Consecutive failure count before opening the breaker. |
| `LYNX_CIRCUIT_BREAKER_COOLDOWN_MS`       | Circuit breaker cooldown in milliseconds.             |
