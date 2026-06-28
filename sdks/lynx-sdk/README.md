# Lynx SDK

TypeScript SDK for collecting AI agent telemetry and sending it to a Lynx server.

The SDK is designed to be safe for production AI services: The SDK does not propagate telemetry delivery errors to the application by default. For latency isolation, enable background delivery. Events are queued in memory, sent in batches, retried with backoff, and can be configured to run fully in the background.

## Install

```bash
pnpm add @repo/sdk
```

## Basic Usage

```ts
import { LynxTracer } from "@repo/sdk";

const lynx = new LynxTracer({
  clientId: "support-api",
  lynxCloudUrl: "https://lynx.example.com",
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

## Production-Safe Delivery Options

Use these options when Lynx telemetry must never add meaningful latency to your AI service.

```ts
const lynx = new LynxTracer({
  clientId: "support-api",
  lynxCloudUrl: "https://lynx.example.com",
  apiKey: process.env.LYNX_API_KEY,

  delivery: {
    mode: "BACKGROUND",
    timeoutMs: 1000,
    flushOnRunEnd: false,
    flushIntervalMs: 5000,
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

| Option                            | Default       | Description                                                                                                                                    |
| --------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `delivery.mode`                   | `"BLOCKING"`  | Use `"BACKGROUND"` to schedule telemetry delivery without waiting in the request path.                                                         |
| `delivery.timeoutMs`              | `5000`        | Maximum duration for one telemetry HTTP request. Use a shorter value, such as `500` to `1000`, for latency-sensitive services.                 |
| `delivery.flushOnRunEnd`          | `true`        | When `true`, `run()` tries to flush telemetry after the wrapped agent work finishes. Set to `false` to keep telemetry out of the request path. |
| `delivery.flushIntervalMs`        | `3000`        | Background flush interval in milliseconds.                                                                                                     |
| `delivery.maxQueueSize`           | `1000`        | Maximum number of queued telemetry events kept in memory.                                                                                      |
| `delivery.overflowStrategy`       | `DROP_OLDEST` | `DROP_OLDEST` keeps the newest events. `DROP_NEWEST` preserves the existing queue and drops incoming events.                                   |
| `circuitBreaker.enabled`          | `true`        | Enables circuit breaker protection for telemetry delivery.                                                                                     |
| `circuitBreaker.failureThreshold` | `3`           | Number of consecutive failed sends before the breaker opens.                                                                                   |
| `circuitBreaker.cooldownMs`       | `30000`       | Time to wait before allowing another send attempt after the breaker opens.                                                                     |

Flat legacy options such as `flushOnRunEnd`, `backgroundOnly`, and `requestTimeoutMs` are still supported for compatibility. Prefer the structured `delivery` and `circuitBreaker` options for new integrations.

## What Happens If the Lynx Server Is Down?

The AI service keeps running.

When delivery fails, the SDK:

- catches network, timeout, and non-2xx response errors
- stores events in an in-memory retry buffer
- applies exponential backoff
- opens the circuit breaker after repeated failures
- drops events according to `delivery.overflowStrategy` if the in-memory queue reaches `delivery.maxQueueSize`

With `delivery.flushOnRunEnd: false` and `delivery.mode: "BACKGROUND"`, Lynx delivery is kept away from the main agent response path.

## Guardrails

`guardTool()` evaluates policy locally through your `beforeCall` callback. Lynx server availability does not decide whether the tool is blocked.

```ts
const refund = lynx.guardTool(
  "refund",
  async ({ amount }: { amount: number }) => ({ refunded: amount }),
  {
    riskLevel: "HIGH",
    sideEffect: true,
    failureMode: "FAIL_CLOSED",
    beforeCall: ({ input }) => {
      return {
        action: input.amount <= 100 ? "ALLOW" : "BLOCK",
        policyId: "refund-limit",
        reason: "Refund amount is over the limit",
        severity: "HIGH",
      };
    },
  },
);
```

If `beforeCall` returns `action: "BLOCK"` or legacy `allow: false`, the SDK blocks the tool call and records policy events. If the Lynx server is unavailable, those events are retried later, but the local block still happens.

If policy evaluation itself throws, `failureMode` decides what to do:

| Failure Mode       | Behavior                                     |
| ------------------ | -------------------------------------------- |
| `FAIL_OPEN`        | Allow the tool call and record policy error. |
| `FAIL_CLOSED`      | Block the tool call.                         |
| `REQUIRE_APPROVAL` | Block with `action: "REQUIRE_APPROVAL"`.     |

## Environment Variables

The default `lynx` export reads these environment variables:

| Variable                                          | Description                                           |
| ------------------------------------------------- | ----------------------------------------------------- |
| `LYNX_CLIENT_ID`                                  | Client or service identifier.                         |
| `LYNX_CLOUD_URL`                                  | Lynx server URL.                                      |
| `LYNX_API_KEY`                                    | API key used for ingestion.                           |
| `LYNX_WORKSPACE_ID`                               | Default workspace id.                                 |
| `LYNX_AGENT_ID`                                   | Default agent id.                                     |
| `LYNX_SAMPLE_RATE`                                | Sampling rate from `0` to `1`.                        |
| `LYNX_CAPTURE_INPUT`                              | Whether to capture inputs.                            |
| `LYNX_CAPTURE_OUTPUT`                             | Whether to capture outputs.                           |
| `LYNX_CAPTURE_MODE`                               | `full`, `metadata-only`, or `smart`.                  |
| `LYNX_MAX_PAYLOAD_LENGTH`                         | Maximum payload string length.                        |
| `LYNX_APP_VERSION`                                | Application version metadata.                         |
| `LYNX_DEPLOYMENT_ID`                              | Deployment id metadata.                               |
| `LYNX_ENVIRONMENT`                                | Runtime environment metadata.                         |
| `LYNX_POLICY_VERSION`                             | Policy version metadata.                              |
| `LYNX_FLUSH_ON_RUN_END`                           | `true` or `false`.                                    |
| `LYNX_BACKGROUND_ONLY`                            | `true` or `false`.                                    |
| `LYNX_REQUEST_TIMEOUT_MS`                         | Telemetry request timeout in milliseconds.            |
| `LYNX_CIRCUIT_BREAKER_ENABLED`                    | `true` or `false`.                                    |
| `LYNX_CIRCUIT_BREAKER_FAILURE_THRESHOLD`          | Consecutive failure count before opening the breaker. |
| `LYNX_CIRCUIT_BREAKER_COOLDOWN_MS`                | Circuit breaker cooldown in milliseconds.             |
| `LYNX_DELIVERY_MODE`                              | `BLOCKING` or `BACKGROUND`.                           |
| `LYNX_DELIVERY_TIMEOUT_MS`                        | Structured delivery timeout in milliseconds.          |
| `LYNX_DELIVERY_FLUSH_ON_RUN_END`                  | Structured delivery `true` or `false`.                |
| `LYNX_DELIVERY_FLUSH_INTERVAL_MS`                 | Structured flush interval in milliseconds.            |
| `LYNX_DELIVERY_MAX_QUEUE_SIZE`                    | Maximum queued event count.                           |
| `LYNX_DELIVERY_OVERFLOW_STRATEGY`                 | `DROP_OLDEST` or `DROP_NEWEST`.                       |
| `LYNX_EXPORTER_CIRCUIT_BREAKER_ENABLED`           | Structured exporter breaker `true` or `false`.        |
| `LYNX_EXPORTER_CIRCUIT_BREAKER_FAILURE_THRESHOLD` | Structured exporter breaker failure count.            |
| `LYNX_EXPORTER_CIRCUIT_BREAKER_COOLDOWN_MS`       | Structured exporter breaker cooldown in milliseconds. |

## Shutdown

Call `shutdown()` when the process is about to exit or when a serverless handler ends.

```ts
await lynx.shutdown();
```

`shutdown()` clears the SDK timer and waits for pending telemetry sends to settle.
