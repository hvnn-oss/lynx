# Lynx SDK

TypeScript SDK for collecting AI agent telemetry and sending it to a Lynx server.

The SDK is designed to be safe for production AI services: telemetry failures should not stop the customer application. Events are queued in memory, sent in batches, retried with backoff, and can be configured to run fully in the background.

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
  lynx.decision("Selected refund workflow");
});
```

## Production-Safe Delivery Options

Use these options when Lynx telemetry must never add meaningful latency to your AI service.

```ts
const lynx = new LynxTracer({
  clientId: "support-api",
  lynxCloudUrl: "https://lynx.example.com",
  apiKey: process.env.LYNX_API_KEY,

  flushOnRunEnd: false,
  backgroundOnly: true,
  requestTimeoutMs: 1000,
  circuitBreakerEnabled: true,
  circuitBreakerFailureThreshold: 3,
  circuitBreakerCooldownMs: 30_000,
});
```

### Option Reference

| Option                           | Default | Description                                                                                                                                    |
| -------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `flushOnRunEnd`                  | `true`  | When `true`, `run()` tries to flush telemetry after the wrapped agent work finishes. Set to `false` to keep telemetry out of the request path. |
| `backgroundOnly`                 | `false` | When `true`, flush schedules network delivery and returns immediately. `shutdown()` still waits for pending sends.                             |
| `requestTimeoutMs`               | `5000`  | Maximum duration for one telemetry HTTP request. Use a shorter value, such as `500` to `1000`, for latency-sensitive services.                 |
| `circuitBreakerEnabled`          | `true`  | Enables circuit breaker protection for telemetry delivery.                                                                                     |
| `circuitBreakerFailureThreshold` | `3`     | Number of consecutive failed sends before the breaker opens.                                                                                   |
| `circuitBreakerCooldownMs`       | `30000` | Time to wait before allowing another send attempt after the breaker opens.                                                                     |

## What Happens If the Lynx Server Is Down?

The AI service keeps running.

When delivery fails, the SDK:

- catches network, timeout, and non-2xx response errors
- stores events in an in-memory retry buffer
- applies exponential backoff
- opens the circuit breaker after repeated failures
- drops oldest buffered events if the retry buffer exceeds its internal limit

With `flushOnRunEnd: false` and `backgroundOnly: true`, Lynx delivery is kept away from the main agent response path.

## Guardrails

`guardTool()` evaluates policy locally through your `beforeCall` callback. Lynx server availability does not decide whether the tool is blocked.

```ts
const refund = lynx.guardTool(
  "refund",
  async ({ amount }: { amount: number }) => ({ refunded: amount }),
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
```

If `beforeCall` returns `allow: false`, the SDK blocks the tool call and records policy events. If the Lynx server is unavailable, those events are retried later, but the local block still happens.

## Environment Variables

The default `lynx` export reads these environment variables:

| Variable                                 | Description                                           |
| ---------------------------------------- | ----------------------------------------------------- |
| `LYNX_CLIENT_ID`                         | Client or service identifier.                         |
| `LYNX_CLOUD_URL`                         | Lynx server URL.                                      |
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
| `LYNX_FLUSH_ON_RUN_END`                  | `true` or `false`.                                    |
| `LYNX_BACKGROUND_ONLY`                   | `true` or `false`.                                    |
| `LYNX_REQUEST_TIMEOUT_MS`                | Telemetry request timeout in milliseconds.            |
| `LYNX_CIRCUIT_BREAKER_ENABLED`           | `true` or `false`.                                    |
| `LYNX_CIRCUIT_BREAKER_FAILURE_THRESHOLD` | Consecutive failure count before opening the breaker. |
| `LYNX_CIRCUIT_BREAKER_COOLDOWN_MS`       | Circuit breaker cooldown in milliseconds.             |

## Shutdown

Call `shutdown()` when the process is about to exit or when a serverless handler ends.

```ts
await lynx.shutdown();
```

`shutdown()` clears the SDK timer and waits for pending telemetry sends to settle.
