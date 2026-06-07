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

const parseArray = (val: string | undefined): string[] | undefined => {
  if (!val) return undefined;
  return val.split(",").map((item) => item.trim());
};

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
});

