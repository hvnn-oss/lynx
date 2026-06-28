import { LynxTracer } from "./tracer.js";

// 환경변수 파싱 헬퍼 함수들
const parseBool = (val: string | undefined): boolean | undefined => {
  if (val === undefined) return undefined;
  return val.toLowerCase() === "true";
};

const parseNum = (val: string | undefined): number | undefined => {
  if (val === undefined) return undefined;
  const num = parseFloat(val);
  return isNaN(num) ? undefined : num;
};

/**
 * Default Lynx tracer instance configured from environment variables.
 *
 * This is the recommended entry point for most applications. Configure it with
 * `LYNX_CLIENT_ID`, `LYNX_CLOUD_URL`, `LYNX_API_KEY`, and optional capture or
 * deployment metadata variables before importing the SDK.
 *
 * @example
 * ```ts
 * import { lynx } from "@repo/sdk";
 *
 * await lynx.run("SupportAgent", async () => {
 *   lynx.userInput("Where is my order?");
 * });
 * ```
 */
export const lynx = new LynxTracer({
  clientId: process.env.LYNX_CLIENT_ID || "local_dev_env",
  lynxCloudUrl: process.env.LYNX_CLOUD_URL || "http://localhost:4000",
  sampleRate: parseNum(process.env.LYNX_SAMPLE_RATE),
  captureInput: parseBool(process.env.LYNX_CAPTURE_INPUT),
  captureOutput: parseBool(process.env.LYNX_CAPTURE_OUTPUT),
  maxPayloadLength: parseNum(process.env.LYNX_MAX_PAYLOAD_LENGTH),
  captureMode: (process.env.LYNX_CAPTURE_MODE as any) || "smart",
  workspaceId: process.env.LYNX_WORKSPACE_ID,
  agentId: process.env.LYNX_AGENT_ID,
  apiKey: process.env.LYNX_API_KEY,
  appVersion: process.env.LYNX_APP_VERSION,
  deploymentId: process.env.LYNX_DEPLOYMENT_ID,
  environment: process.env.LYNX_ENVIRONMENT || process.env.NODE_ENV,
  policyVersion: process.env.LYNX_POLICY_VERSION,
  flushOnRunEnd: parseBool(process.env.LYNX_FLUSH_ON_RUN_END),
  requestTimeoutMs: parseNum(process.env.LYNX_REQUEST_TIMEOUT_MS),
  backgroundOnly: parseBool(process.env.LYNX_BACKGROUND_ONLY),
  circuitBreakerEnabled: parseBool(process.env.LYNX_CIRCUIT_BREAKER_ENABLED),
  circuitBreakerFailureThreshold: parseNum(
    process.env.LYNX_CIRCUIT_BREAKER_FAILURE_THRESHOLD,
  ),
  circuitBreakerCooldownMs: parseNum(
    process.env.LYNX_CIRCUIT_BREAKER_COOLDOWN_MS,
  ),
});
