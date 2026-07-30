import { createMiddleware } from "hono/factory";

import type { AppEnv } from "../types/app-env.js";
import {
  auditLogService,
  type AuditLogRecorder,
  type RecordAuditLogInput,
} from "../services/audit-log.service.js";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const AUDIT_PAYLOAD_MAX_BYTES = 32 * 1024;
const AUDIT_STRING_MAX_LENGTH = 4_000;
const AUDIT_ARRAY_MAX_LENGTH = 100;
const AUDIT_OBJECT_MAX_KEYS = 100;
const SENSITIVE_FIELD_PATTERN =
  /^(authorization|cookie|password|passwordhash|token|accesstoken|refreshtoken|apikey|secret|clientsecret|oidcclientsecret|webhookurl|webhookurlciphertext|samlcert|privatekey|secretaccesskey)$/i;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 성공한 주요 관리 요청을 감사 기록으로 변환하는 미들웨어를 만듭니다. */
export function createAuditLogMiddleware(
  recorder: AuditLogRecorder = auditLogService,
) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const descriptor = describeAuditedMutation(c.req.method, c.req.path);
    const requestDataPromise = descriptor
      ? captureAuditRequest(c.req.raw)
      : Promise.resolve(null);

    await next();

    if (!MUTATION_METHODS.has(c.req.method) || c.res.status >= 400) return;
    const actorUserId = c.get("currentUserId");
    if (!actorUserId) return;
    if (!descriptor) return;

    const [requestData, responseData] = await Promise.all([
      requestDataPromise,
      captureAuditResponse(c.res),
    ]);
    await recorder.record({
      actorUserId,
      ...descriptor,
      requestId: c.get("requestId"),
      metadata: {
        method: c.req.method,
        path: c.req.path,
        statusCode: c.res.status,
        request: requestData,
        response: responseData,
      },
    });
  });
}

interface AuditDescriptor extends Pick<
  RecordAuditLogInput,
  "action" | "targetType" | "targetId" | "workspaceId" | "organizationId"
> {}

/** 비밀값을 읽지 않고 URL 구조만으로 감사 대상과 작업 종류를 결정합니다. */
export function describeAuditedMutation(
  method: string,
  path: string,
): AuditDescriptor | null {
  const segments = path.split("/").filter(Boolean);
  const workspaceIndex = segments.indexOf("workspace");
  const organizationIndex = segments.indexOf("organization");
  const workspaceId =
    workspaceIndex >= 0 && UUID_PATTERN.test(segments[workspaceIndex + 1] ?? "")
      ? segments[workspaceIndex + 1]
      : undefined;
  const organizationId =
    organizationIndex >= 0 &&
    UUID_PATTERN.test(segments[organizationIndex + 1] ?? "")
      ? segments[organizationIndex + 1]
      : undefined;

  const resource = findManagedResource(segments);
  if (!resource) return null;
  const targetId =
    findResourceTargetId(segments, resource.segment) ??
    workspaceId ??
    organizationId ??
    "collection";
  const operation = findOperation(method, segments, resource.segment);
  if (!operation) return null;

  return {
    action: `${resource.type}.${operation}`,
    targetType: resource.type,
    targetId,
    workspaceId,
    organizationId,
  };
}

function findManagedResource(
  segments: string[],
): { segment: string; type: string } | null {
  const resources = [
    ["firewall-policies", "firewall_policy"],
    ["firewall-approvals", "firewall_approval"],
    ["prompts", "prompt"],
    ["api-keys", "workspace_api_key"],
    ["integrations", "integration"],
    ["invitations", "invitation"],
    ["invite", "invitation"],
    ["members", "organization_member"],
    ["owner", "organization_owner"],
    ["profile", "organization_profile"],
    ["organization", "organization"],
  ] as const;
  const found = resources.find(([segment]) => segments.includes(segment));
  if (found) return { segment: found[0], type: found[1] };

  if (segments.join("/") === "workspace/create") {
    return { segment: "workspace", type: "workspace" };
  }
  if (segments.join("/") === "organization/create") {
    return { segment: "organization", type: "organization" };
  }
  return null;
}

function findResourceTargetId(
  segments: string[],
  resourceSegment: string,
): string | undefined {
  const resourceIndex = segments.indexOf(resourceSegment);
  const candidate = segments[resourceIndex + 1];
  if (!candidate) return undefined;
  if (
    [
      "activate",
      "deactivate",
      "deploy",
      "rollback",
      "versions",
      "experiments",
      "image",
      "slack",
      "test",
      "accept",
      "create",
    ].includes(candidate)
  ) {
    return undefined;
  }
  return candidate;
}

function findOperation(
  method: string,
  segments: string[],
  resourceSegment: string,
): string | null {
  const tail = segments.slice(segments.indexOf(resourceSegment) + 1);
  if (tail.includes("simulate")) return null;
  if (resourceSegment === "owner") return "transfer";
  if (tail.includes("role")) return "role_change";
  if (tail.includes("accept")) return "accept";
  if (tail.includes("retry")) return "retry";
  if (tail.includes("activate")) return "activate";
  if (tail.includes("deactivate")) return "deactivate";
  if (tail.includes("deployments")) return method === "POST" ? "deploy" : null;
  if (tail.includes("deploy")) return "deploy";
  if (tail.includes("rollback")) return "rollback";
  if (tail.includes("versions"))
    return method === "POST" ? "create_version" : null;
  if (tail.includes("experiments")) {
    return method === "POST" ? "create_experiment" : "update_experiment";
  }
  if (tail.includes("test") || tail.includes("webhook-test")) return "test";
  if (tail.includes("image")) return "update_image";
  if (method === "DELETE") return "delete";
  if (method === "PATCH" || method === "PUT") return "update";
  if (method === "POST") return "create";
  return null;
}

export const auditLogMiddleware = createAuditLogMiddleware();

/** 요청의 query와 JSON 본문을 민감값을 제거한 뒤 제한된 크기로 복사합니다. */
export async function captureAuditRequest(
  request: Request,
): Promise<Record<string, unknown>> {
  const url = new URL(request.url);
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of url.searchParams.entries()) {
    const existing = query[key];
    query[key] =
      existing === undefined
        ? value
        : Array.isArray(existing)
          ? [...existing, value]
          : [existing, value];
  }

  return {
    query: sanitizeAuditValue(query),
    body: await captureJsonBody(request),
  };
}

/** 성공 응답의 JSON 본문을 민감값을 제거한 뒤 제한된 크기로 복사합니다. */
export async function captureAuditResponse(
  response: Response,
): Promise<Record<string, unknown>> {
  return {
    statusCode: response.status,
    body: await captureJsonBody(response),
  };
}

async function captureJsonBody(message: Request | Response): Promise<unknown> {
  const contentType = message.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) return null;

  const contentLength = Number(message.headers.get("content-length") ?? "0");
  if (
    Number.isFinite(contentLength) &&
    contentLength > AUDIT_PAYLOAD_MAX_BYTES
  ) {
    return { omitted: "PAYLOAD_TOO_LARGE", contentLength };
  }

  try {
    const text = await message.clone().text();
    if (!text) return null;
    const sanitized = sanitizeAuditValue(JSON.parse(text));
    const serialized = JSON.stringify(sanitized);
    if (Buffer.byteLength(serialized, "utf8") <= AUDIT_PAYLOAD_MAX_BYTES) {
      return sanitized;
    }
    return {
      truncated: true,
      preview: serialized.slice(0, AUDIT_PAYLOAD_MAX_BYTES),
    };
  } catch {
    return { omitted: "UNREADABLE_JSON" };
  }
}

/** 감사 화면에 노출되면 안 되는 인증정보를 재귀적으로 마스킹합니다. */
export function sanitizeAuditValue(value: unknown, depth = 0): unknown {
  if (depth >= 8) return "[MAX_DEPTH]";
  if (typeof value === "string") {
    return value.length > AUDIT_STRING_MAX_LENGTH
      ? `${value.slice(0, AUDIT_STRING_MAX_LENGTH)}…`
      : value;
  }
  if (Array.isArray(value)) {
    const items = value
      .slice(0, AUDIT_ARRAY_MAX_LENGTH)
      .map((item) => sanitizeAuditValue(item, depth + 1));
    if (value.length > AUDIT_ARRAY_MAX_LENGTH) items.push("[TRUNCATED]");
    return items;
  }
  if (!value || typeof value !== "object") return value;

  const sanitized: Record<string, unknown> = {};
  const entries = Object.entries(value).slice(0, AUDIT_OBJECT_MAX_KEYS);
  for (const [key, item] of entries) {
    const normalizedKey = key.replaceAll("_", "").replaceAll("-", "");
    sanitized[key] = SENSITIVE_FIELD_PATTERN.test(normalizedKey)
      ? "[REDACTED]"
      : sanitizeAuditValue(item, depth + 1);
  }
  if (Object.keys(value).length > AUDIT_OBJECT_MAX_KEYS) {
    sanitized.__truncated = true;
  }
  return sanitized;
}
