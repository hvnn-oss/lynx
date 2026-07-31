# Lynx SDK

TypeScript SDK for tracing, debugging, and governing AI agent runs with Lynx.

## Pilot status

> Lynx is currently a pilot-stage project. APIs and behavior may change before
> the general release. If you want to join the pilot or evaluate Lynx for your
> service, contact [partners@hvnn.me](mailto:partners@hvnn.me).

Lynx records what happened during an agent run: user input, agent decisions,
LLM calls, tool calls, context loading, policy decisions, retries, errors, and
the final outcome. The SDK isolates event delivery failures from your
application by default.

This SDK is designed for Node.js server-side runtimes. Browser and edge runtime
support are not guaranteed yet.

## Installation

```bash
pnpm add @lynxops/sdk
```

```bash
npm install @lynxops/sdk
```

```bash
yarn add @lynxops/sdk
```

## Quick Start

```ts
import { LynxTracer } from "@lynxops/sdk";

const lynx = new LynxTracer({
  clientId: "support-api",
  apiKey: process.env.LYNX_API_KEY,
  workspaceId: process.env.LYNX_WORKSPACE_ID,
  environment: "production",
});

await lynx.run("SupportAgent", async () => {
  lynx.userInput("I want a refund", { userId: "usr_123" });
  lynx.setAttributes({ orderId: "order_123" });

  lynx.context("refund-policy", {
    refundWindowDays: 30,
  });

  lynx.decision({
    name: "select_refund_workflow",
    selected: "refund",
    confidence: 0.82,
    reason: "Order is inside the refund window",
  });

  lynx.outcome({
    status: "COMPLETED",
    businessStatus: "SUCCEEDED",
    reason: "Refund request was accepted",
  });
});
```

In serverless functions, CLI scripts, tests, or other short-lived processes,
call `shutdown()` before the process exits so queued background events can be
flushed.

```ts
await lynx.shutdown({ timeoutMs: 1000 });
```

By default, events are sent to:

```text
https://api.lynxops.co
```

Use `endpoint` or `LYNX_ENDPOINT` for local development or self-hosted
deployments.

## Default Instance

The SDK exports a default `lynx` instance configured from environment
variables.

```ts
import { lynx } from "@lynxops/sdk";

await lynx.run("ResearchAgent", async () => {
  lynx.userInput("Find the latest invoice policy");
  lynx.decision("search internal docs first");
});
```

```bash
LYNX_CLIENT_ID=support-api
LYNX_API_KEY=lynx_sk_...
LYNX_WORKSPACE_ID=...
LYNX_ENVIRONMENT=production
```

## Production Delivery Model

The SDK prioritizes your application over event delivery.

Production-oriented defaults:

| Option                            | Default                  |
| --------------------------------- | ------------------------ |
| `endpoint`                        | `https://api.lynxops.co` |
| `delivery.mode`                   | `BACKGROUND`             |
| `delivery.timeoutMs`              | `1000`                   |
| `delivery.flushOnRunEnd`          | `false`                  |
| `delivery.flushIntervalMs`        | `3000`                   |
| `delivery.batchSize`              | `50`                     |
| `delivery.maxQueueSize`           | `1000`                   |
| `delivery.overflowStrategy`       | `DROP_OLDEST`            |
| `circuitBreaker.enabled`          | `true`                   |
| `circuitBreaker.failureThreshold` | `3`                      |
| `circuitBreaker.cooldownMs`       | `30000`                  |

Recommended production configuration:

```ts
const lynx = new LynxTracer({
  clientId: "support-api",
  apiKey: process.env.LYNX_API_KEY,
  workspaceId: process.env.LYNX_WORKSPACE_ID,

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

If the Lynx API is unavailable, the SDK:

- catches network, timeout, and non-2xx delivery errors
- queues events in memory
- retries with backoff
- opens a circuit breaker after repeated failures
- drops events according to the configured overflow strategy when the queue is
  full

With the default background delivery mode, `run()` does not wait for event
HTTP requests.

## Capturing Agent Runs

Use `run()` as the unit of work for one agent execution.

```ts
await lynx.run(
  {
    agentName: "InvoiceAgent",
    workspaceId: "workspace_123",
    agentId: "agent_invoice",
    sessionId: "session_456",
    assignmentKey: "user_789",
  },
  async () => {
    lynx.userInput("Can this invoice be paid?");
    lynx.decision("verify vendor and payment policy");
  },
);
```

Useful identifiers:

| Field           | Purpose                                                                         |
| --------------- | ------------------------------------------------------------------------------- |
| `runId`         | Unique execution id for one agent run. Generated automatically unless provided. |
| `sessionId`     | Groups multiple runs or events into a user-visible session.                     |
| `workspaceId`   | Tenant boundary for Lynx ingestion and dashboards.                              |
| `agentId`       | Stable agent identifier.                                                        |
| `agentName`     | Human-readable agent name shown in debugging views.                             |
| `assignmentKey` | Stable user, tenant, or session key used for prompt A/B assignment.             |
| `environment`   | Runtime environment such as `production`, `staging`, or `local`.                |
| `appVersion`    | Application release metadata.                                                   |
| `deploymentId`  | Deployment metadata for incident correlation.                                   |
| `promptVersion` | Prompt version metadata attached to LLM and reasoning events.                   |
| `policyVersion` | Firewall or policy version metadata.                                            |

## Managed Prompts

Create a prompt in the Lynx dashboard, save its draft, create an immutable
version, and deploy that version to Staging or Production. A saved draft is not
returned to the SDK until an immutable version is deployed.

The workspace API key must have both `config:read` and `policies:read`. Its
environment selects the matching deployment. Set a tracer-level `agentId` when
the deployment targets one Agent.

```ts
const lynx = new LynxTracer({
  clientId: "support-api",
  apiKey: process.env.LYNX_API_KEY,
  agentId: "support-agent",
  environment: "production",
  runtimeConfig: {
    enabled: true,
    refreshIntervalMs: 60_000,
    cache: {
      enabled: true,
    },
  },
});

await lynx.run(
  {
    agentName: "SupportAgent",
    assignmentKey: "customer_123",
  },
  async () => {
    const prompt = await lynx.getPrompt("support-system");

    return callModel({
      instructions: prompt.content,
      input: "Help me reset my password",
    });
  },
);
```

`getPrompt()` accepts a stable prompt name or UUID and returns `promptId`,
`name`, `versionId`, `version`, `content`, and `contentHash`. A prompt selected
by an active experiment also includes optional `experiment` assignment
metadata. Calling it inside `run()` pins that immutable version for the run and
records one experiment exposure. Lynx sends the experiment ID, selected
version, bucket, and runtime configuration revision, but never sends the raw
`assignmentKey`.

The SDK checks for new runtime configuration every 60 seconds by default, uses
ETag revalidation, verifies prompt content hashes, and keeps the last known good
bundle. Persistent `.lynxconf` caching is disabled by default. An explicit
`getPrompt()` call throws if no valid bundle exists or the prompt is not
deployed, so keep a local fallback when the application must continue without
Lynx.

## Semantic Events

Prefer semantic helpers over raw event logging. They make Lynx debugging views
more useful.

```ts
lynx.userInput("Book a flight to Seoul", { userId: "usr_123" });

lynx.context("calendar-availability", {
  daysLoaded: 14,
  source: "calendar-api",
});

lynx.decision({
  name: "choose_booking_tool",
  selected: "flight_search",
  alternatives: ["email_assistant", "manual_handoff"],
  confidence: 0.76,
  reason: "The user requested a travel booking action",
});

lynx.log("tool.timeout", {
  error: "Travel API timed out",
  toolName: "travel.search",
});

lynx.outcome({
  status: "FAILED",
  businessStatus: "FAILED",
  reason: "The external travel API timed out",
  userImpact: "MEDIUM",
});
```

Root `run()` calls automatically record a technical `COMPLETED` or `FAILED`
outcome when `outcome()` is omitted. Use `outcome()` when business success can
differ from whether the callback returned or threw; an explicit outcome
suppresses the automatic one.

## Record LLM calls

Use `instrumentLLM()` to wrap a model client. The returned proxy preserves the
original client shape while recording supported model calls.

```ts
const instrumentedClient = lynx.instrumentLLM(client, {
  modelLabel: "openai.gpt-4.1-mini",
});

await lynx.run("SupportAgent", async () => {
  await instrumentedClient.responses.create({
    model: "gpt-4.1-mini",
    input: "Summarize this support ticket",
    metadata: {
      promptVersion: "support-summary-v3",
    },
  });
});
```

## Record tool calls

Use `instrumentTool()` to wrap a reusable tool function.

```ts
const postSlackMessage = lynx.instrumentTool(
  "slack.postMessage",
  async (input: { channel: string; text: string }) => {
    return await slack.chat.postMessage(input);
  },
  {
    sideEffect: true,
    riskLevel: "MEDIUM",
    externalTarget: "slack",
    timeoutMs: 5000,
  },
);

await postSlackMessage({
  channel: "C123",
  text: "Refund approved",
});
```

When `issueReporting.enabled` is `true`, a thrown tool error is reported as
`TOOL_ERROR`, and an asynchronous call that exceeds `timeoutMs` is reported as
`TOOL_TIMEOUT`. Lynx groups repeated failures without using the raw error
message in the fingerprint. After three successful calls by default, the SDK
sends a recovery record.

Set `reportFailures: false` for a tool whose errors are expected and handled by
your application. `timeoutMs` does not cancel the underlying operation; use the
tool's own `AbortSignal` or cancellation API when a timed-out operation must
stop.

## Automatic Run and LLM Issues

With `issueReporting.enabled: true`, Lynx also reports:

- `RUN_ERROR` when the root `run()` callback rethrows an unhandled error.
- `RUN_FAILED` when `outcome()` records a failed technical or business result.
- `LLM_ERROR` when an `instrumentLLM()` or `guardLLM()` call fails.
- `LLM_SLOW_RESPONSE` after two consecutive LLM calls exceed 10 seconds by
  default.

Specific Tool, LLM, and firewall detections suppress a duplicate root Run issue.
Raw error messages are retained only as bounded evidence and are not used in
the stable fingerprint. Configure `slowLlmThresholdMs` and
`slowLlmConsecutiveOccurrences` for the latency profile of your models. Set a
wrapper's `reportFailures` or `reportSlowResponses` to `false` when that call is
expected to fail or run slowly.

## Local Firewalls

`firewallTool()` evaluates your policy locally before a tool runs. Lynx server
availability does not decide whether the tool is blocked.

```ts
import { LynxPolicyError } from "@lynxops/sdk";

const refund = lynx.firewallTool(
  "refund.create",
  async ({ amount }: { amount: number }) => {
    return { refunded: amount };
  },
  {
    sideEffect: true,
    riskLevel: "HIGH",
    failureMode: "FAIL_CLOSED",
    beforeCall: ({ input }) => {
      if (input.amount > 100) {
        return {
          action: "BLOCK",
          policyId: "refund-limit",
          reason: "Refund amount is over the approved limit",
          severity: "HIGH",
        };
      }

      return {
        action: "ALLOW",
        policyId: "refund-limit",
      };
    },
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

Use `guardLLM()` when both model input and output must be evaluated locally.
For async iterable streams, output is checked before each chunk is yielded and
a bounded trailing text buffer detects matches split across chunks.

```ts
const guardedModel = lynx.guardLLM(openai, {
  modelLabel: "support-model",
  firewall: {
    input: {
      select: (request) => request.messages,
      riskLevel: "HIGH",
    },
    output: {
      select: (response) => response.output_text,
      riskLevel: "HIGH",
    },
  },
});
```

Policy behavior:

| Policy result      | Behavior                                              |
| ------------------ | ----------------------------------------------------- |
| `ALLOW`            | Runs the tool and records policy evaluation metadata. |
| `WARN`             | Runs the tool and records a warning.                  |
| `BLOCK`            | Blocks the tool and throws `LynxPolicyError`.         |
| `REQUIRE_APPROVAL` | Blocks the tool and throws `LynxPolicyError`.         |

If policy evaluation itself throws, `failureMode` decides the fallback:

| Failure mode       | Behavior                                           |
| ------------------ | -------------------------------------------------- |
| `FAIL_OPEN`        | Allows the tool call and records the policy error. |
| `FAIL_CLOSED`      | Blocks the tool call.                              |
| `REQUIRE_APPROVAL` | Blocks with `action: "REQUIRE_APPROVAL"`.          |

## Capture Modes

Lynx does not require you to store full payloads.

| Mode            | Behavior                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `full`          | Captures input and output payloads according to `captureInput` and `captureOutput`.                                    |
| `metadata-only` | Keeps structure, timing, token usage, cost, status, errors, tool names, and trace metadata without raw content.        |
| `smart`         | Captures metadata for normal events and preserves richer detail for failures, policy violations, and abnormal latency. |

```ts
const lynx = new LynxTracer({
  clientId: "support-api",
  apiKey: process.env.LYNX_API_KEY,
  captureMode: "smart",
  maxPayloadLength: 16_000,
  maxPayloadBytes: 64 * 1024,
});
```

## Flush, Shutdown, and Health

Use `flush()` to send the current queue while keeping the SDK active.

```ts
await lynx.flush();
```

Use `shutdown()` when the process is about to exit, in serverless handlers, or
in tests.

```ts
await lynx.shutdown({ timeoutMs: 1000 });
```

Use `getStatus()` for local diagnostics.

```ts
const status = lynx.getStatus();

console.log({
  queueSize: status.queueSize,
  droppedEvents: status.droppedEvents,
  circuitState: status.circuitState,
  pendingTransmissions: status.pendingTransmissions,
  issueQueueSize: status.issueReporting.queueSize,
  droppedIssueRecords: status.issueReporting.droppedRecords,
  runtimeConfigUsable: status.runtimeConfig.isUsable,
});
```

## Configuration Reference

```ts
const lynx = new LynxTracer({
  clientId: "support-api",
  endpoint: "https://api.lynxops.co",
  workspaceId: "workspace_123",
  agentId: "agent_support",
  apiKey: process.env.LYNX_API_KEY,
  appVersion: "2026.06.29",
  deploymentId: "deploy_123",
  environment: "production",
  policyVersion: "policy_2026_06",
  sampleRate: 1,
  captureInput: true,
  captureOutput: true,
  captureMode: "smart",
  maxPayloadLength: 16_000,
  maxPayloadBytes: 64 * 1024,
  runtimeConfig: {
    enabled: true,
    refreshIntervalMs: 60_000,
    maxStaleAgeMs: 24 * 60 * 60 * 1000,
    requireSignature: true,
    signaturePublicKey: process.env.LYNX_RUNTIME_CONFIG_SIGNATURE_PUBLIC_KEY,
    requireTargetMatch: true,
    cache: {
      enabled: true,
      path: "./.lynxconf",
    },
  },
  delivery: {
    mode: "BACKGROUND",
    timeoutMs: 1000,
    flushOnRunEnd: false,
    flushIntervalMs: 3000,
    batchSize: 50,
    maxQueueSize: 1000,
    overflowStrategy: "DROP_OLDEST",
  },
  circuitBreaker: {
    enabled: true,
    failureThreshold: 3,
    cooldownMs: 30_000,
  },
});
```

| Option                                    | Description                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `clientId`                                | Required service or client identifier.                                 |
| `endpoint`                                | Lynx API endpoint. Defaults to `https://api.lynxops.co`.               |
| `workspaceId`                             | Default workspace id attached to events.                               |
| `agentId`                                 | Default agent id attached to events.                                   |
| `apiKey`                                  | Workspace API key sent only through `X-API-Key`.                       |
| `appVersion`                              | Application version metadata.                                          |
| `deploymentId`                            | Deployment id metadata.                                                |
| `environment`                             | Runtime environment metadata.                                          |
| `policyVersion`                           | Default policy version metadata.                                       |
| `sampleRate`                              | Trace sampling ratio from `0` to `1`.                                  |
| `captureInput`                            | Whether input payloads can be captured.                                |
| `captureOutput`                           | Whether output payloads can be captured.                               |
| `captureMode`                             | `full`, `metadata-only`, or `smart`.                                   |
| `maxPayloadLength`                        | Backward-compatible per-string truncation limit.                       |
| `maxPayloadBytes`                         | Maximum UTF-8 JSON size retained for one event payload.                |
| `smartDetailLatencyThresholdMs`           | Latency threshold for preserving masked detail in `smart` mode.        |
| `runtimeConfig.enabled`                   | Loads managed prompts and firewall policies before the first run.      |
| `runtimeConfig.refreshIntervalMs`         | Background runtime configuration refresh interval.                     |
| `runtimeConfig.maxStaleAgeMs`             | Maximum age of a validated bundle. Defaults to 24 hours.               |
| `runtimeConfig.requireSignature`          | Rejects runtime bundles without a valid Ed25519 signature.             |
| `runtimeConfig.requireTargetMatch`        | Rejects another environment or an unresolved Agent scope.              |
| `runtimeConfig.cache.enabled`             | Persists the last validated bundle. Defaults to `false`.               |
| `runtimeConfig.cache.path`                | Exact `.lynxconf` path. Uses the OS user cache directory when omitted. |
| `runtimeConfig.cache.storage`             | Custom byte storage for environments without a writable filesystem.    |
| `issueReporting.enabled`                  | Sends detected issue and recovery records in the background.           |
| `issueReporting.reportRunFailures`        | Reports root Run exceptions and explicit failed outcomes.              |
| `issueReporting.reportLlmFailures`        | Reports errors from instrumented LLM calls.                            |
| `issueReporting.slowLlmThresholdMs`       | Slow LLM threshold. Defaults to `10000`; `0` disables it.              |
| `issueReporting.slowLlmConsecutiveOccurrences` | Consecutive slow calls required. Defaults to `2`.                |
| `issueReporting.recoverySuccessThreshold` | Consecutive healthy observations required before recovery.             |
| `delivery.mode`                           | `BACKGROUND` or `BLOCKING`.                                            |
| `delivery.timeoutMs`                      | Timeout for one event delivery request.                                |
| `delivery.flushOnRunEnd`                  | Whether `run()` tries to flush after the wrapped work finishes.        |
| `delivery.flushIntervalMs`                | Background flush interval.                                             |
| `delivery.batchSize`                      | Batch size for delivery.                                               |
| `delivery.maxQueueSize`                   | Maximum queued events in memory.                                       |
| `delivery.overflowStrategy`               | `DROP_OLDEST` or `DROP_NEWEST`.                                        |
| `circuitBreaker.enabled`                  | Enables delivery circuit breaker protection.                           |
| `circuitBreaker.failureThreshold`         | Consecutive delivery failures before opening the breaker.              |
| `circuitBreaker.cooldownMs`               | Cooldown before retrying after the breaker opens.                      |

## Environment Variables

The default `lynx` export reads these variables:

| Variable                                 | Description                                                |
| ---------------------------------------- | ---------------------------------------------------------- |
| `LYNX_CLIENT_ID`                         | Client or service identifier. Defaults to `local_dev_env`. |
| `LYNX_ENDPOINT`                          | Optional Lynx API endpoint override.                       |
| `LYNX_API_KEY`                           | Lynx ingestion API key.                                    |
| `LYNX_WORKSPACE_ID`                      | Default workspace id.                                      |
| `LYNX_AGENT_ID`                          | Default agent id.                                          |
| `LYNX_SESSION_ID`                        | Default session id when `run()` does not receive one.      |
| `LYNX_SAMPLE_RATE`                       | Sampling rate from `0` to `1`.                             |
| `LYNX_CAPTURE_INPUT`                     | `true` or `false`.                                         |
| `LYNX_CAPTURE_OUTPUT`                    | `true` or `false`.                                         |
| `LYNX_CAPTURE_MODE`                      | `full`, `metadata-only`, or `smart`.                       |
| `LYNX_MAX_PAYLOAD_LENGTH`                | Maximum payload string length.                             |
| `LYNX_MAX_PAYLOAD_BYTES`                 | Maximum UTF-8 JSON bytes retained per event payload.       |
| `LYNX_SMART_DETAIL_LATENCY_THRESHOLD_MS` | Smart-mode detail retention latency threshold.             |
| `LYNX_APP_VERSION`                       | Application version metadata.                              |
| `LYNX_DEPLOYMENT_ID`                     | Deployment id metadata.                                    |
| `LYNX_ENVIRONMENT`                       | Runtime environment metadata. Falls back to `NODE_ENV`.    |
| `LYNX_POLICY_VERSION`                    | Default policy version metadata.                           |
| `LYNX_ISSUE_REPORTING_ENABLED`           | Enables background issue-candidate and recovery records.   |
| `LYNX_ISSUE_REPORT_RUN_FAILURES`         | Enables root Run and failed-outcome issue candidates.       |
| `LYNX_ISSUE_REPORT_LLM_FAILURES`         | Enables instrumented LLM error issue candidates.            |
| `LYNX_ISSUE_SLOW_LLM_THRESHOLD_MS`       | Slow LLM threshold; `0` disables latency candidates.        |
| `LYNX_ISSUE_SLOW_LLM_CONSECUTIVE_OCCURRENCES` | Consecutive slow calls required before reporting.      |
| `LYNX_ISSUE_REPORTING_TIMEOUT_MS`        | Timeout for one issue-record request.                      |
| `LYNX_ISSUE_REPORTING_MAX_QUEUE_SIZE`    | Maximum queued issue-record count.                         |
| `LYNX_ISSUE_REPORTING_MAX_ATTEMPTS`      | Maximum delivery attempts for one issue record.            |
| `LYNX_ISSUE_RECOVERY_SUCCESS_THRESHOLD`  | Healthy calls required before recovery. Defaults to `3`.   |
| `LYNX_DELIVERY_MODE`                     | `BACKGROUND` or `BLOCKING`.                                |
| `LYNX_DELIVERY_TIMEOUT_MS`               | Delivery timeout in milliseconds.                          |
| `LYNX_DELIVERY_FLUSH_ON_RUN_END`         | `true` or `false`.                                         |
| `LYNX_DELIVERY_FLUSH_INTERVAL_MS`        | Flush interval in milliseconds.                            |
| `LYNX_DELIVERY_BATCH_SIZE`               | Batch size.                                                |
| `LYNX_DELIVERY_MAX_QUEUE_SIZE`           | Maximum queued event count.                                |
| `LYNX_DELIVERY_OVERFLOW_STRATEGY`        | `DROP_OLDEST` or `DROP_NEWEST`.                            |
| `LYNX_CIRCUIT_BREAKER_ENABLED`           | `true` or `false`.                                         |
| `LYNX_CIRCUIT_BREAKER_FAILURE_THRESHOLD` | Consecutive failure count before opening the breaker.      |
| `LYNX_CIRCUIT_BREAKER_COOLDOWN_MS`       | Circuit breaker cooldown in milliseconds.                  |

## Development

```bash
pnpm install
pnpm build
pnpm test
```

The SDK is ESM-first and also publishes a CommonJS build through package
exports.

## Runtime Support

`@lynxops/sdk` supports Node.js 18 and newer. It uses Node runtime APIs such as
`AsyncLocalStorage`, global `fetch`, `AbortSignal.timeout`, and process
lifecycle hooks.

## Security

Please report security issues privately to `security@lynxops.co`. See
`SECURITY.md` for details.

## License

ISC
