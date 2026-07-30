import { createHash } from "node:crypto";

/**
 * Produces a deterministic SHA-256 digest for arbitrary SDK payloads.
 *
 * Object keys are sorted recursively so semantically identical JSON objects
 * produce the same digest even when their insertion order differs. Unsupported
 * JSON primitives receive explicit markers instead of being silently dropped.
 *
 * @param value Value used for policy evidence, loop detection, or approvals.
 * @returns A lowercase 64-character SHA-256 digest.
 */
export function createStableHash(value: unknown): string {
  return createHash("sha256")
    .update(stableSerialize(value), "utf8")
    .digest("hex");
}

/** Serializes one value without depending on object insertion order. */
function stableSerialize(value: unknown): string {
  const ancestors = new WeakSet<object>();

  const visit = (current: unknown): string => {
    if (current === null) return "null";
    if (current === undefined) return '"[Undefined]"';
    if (typeof current === "string") return JSON.stringify(current);
    if (typeof current === "boolean") return String(current);
    if (typeof current === "number") {
      return Number.isFinite(current)
        ? String(current)
        : JSON.stringify(`[${String(current)}]`);
    }
    if (typeof current === "bigint") {
      return JSON.stringify(`[BigInt:${current.toString()}]`);
    }
    if (typeof current === "symbol") {
      return JSON.stringify(`[Symbol:${current.description ?? ""}]`);
    }
    if (typeof current === "function") {
      return JSON.stringify(`[Function:${current.name || "anonymous"}]`);
    }
    if (current instanceof Date) {
      return JSON.stringify(`[Date:${current.toISOString()}]`);
    }
    if (current instanceof Uint8Array) {
      return JSON.stringify(
        `[Bytes:${Buffer.from(current).toString("base64url")}]`,
      );
    }
    if (typeof current !== "object") return JSON.stringify(String(current));
    if (ancestors.has(current)) return '"[Circular]"';

    ancestors.add(current);
    try {
      if (Array.isArray(current)) {
        return `[${current.map((item) => visit(item)).join(",")}]`;
      }
      const record = current as Record<string, unknown>;
      return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${visit(record[key])}`)
        .join(",")}}`;
    } finally {
      ancestors.delete(current);
    }
  };

  return visit(value);
}
