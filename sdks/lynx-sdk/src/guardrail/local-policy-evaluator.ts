import type {
  LynxPolicyAction,
  LynxPolicyDecision,
  LynxRuntimePolicySnapshot,
  LynxToolMetadata,
} from "../core/types.js";

interface ToolPolicyContext {
  toolName: string;
  input: unknown;
  metadata: LynxToolMetadata;
}

const CONDITION_PATTERN =
  /^\s*(tool\.(?:name|riskLevel|sideEffect|externalTarget)|input(?:\.[A-Za-z0-9_-]+)*)\s*(==|!=|>=|<=|>|<|contains)\s*(.+?)\s*$/;
const UNSAFE_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

/**
 * Evaluates the intentionally small Lynx guardrail expression language.
 *
 * Supported expressions compare tool metadata or nested input fields using
 * `==`, `!=`, numeric ordering operators, and `contains`. Arbitrary JavaScript
 * is never executed.
 */
export class LocalPolicyEvaluator {
  /**
   * Evaluates every active policy and returns the strongest matching decision.
   *
   * @throws When a policy condition or action cannot be safely interpreted.
   */
  evaluate(
    policies: readonly LynxRuntimePolicySnapshot[],
    context: ToolPolicyContext,
  ): LynxPolicyDecision {
    const matches = policies
      .filter((policy) => this.matches(policy.condition, context))
      .map((policy) => this.toDecision(policy));
    return (
      matches.sort(
        (left, right) =>
          this.actionRank(right.action) - this.actionRank(left.action),
      )[0] ?? { action: "ALLOW" }
    );
  }

  /** Parses and evaluates one condition against a tool call context. */
  private matches(condition: string, context: ToolPolicyContext): boolean {
    const parsed = CONDITION_PATTERN.exec(condition);
    if (!parsed) {
      throw new Error(`Unsupported Lynx policy condition: ${condition}`);
    }
    const path = parsed[1]!;
    const operator = parsed[2]!;
    const rawExpected = parsed[3]!;
    const actual = this.readPath(path, context);
    const expected = this.parseLiteral(rawExpected);
    return this.compare(actual, operator, expected);
  }

  /** Resolves only allow-listed tool fields and safe nested input properties. */
  private readPath(path: string, context: ToolPolicyContext): unknown {
    if (path === "tool.name") return context.toolName;
    if (path === "tool.riskLevel") return context.metadata.riskLevel;
    if (path === "tool.sideEffect") return context.metadata.sideEffect;
    if (path === "tool.externalTarget") return context.metadata.externalTarget;

    const segments = path.split(".").slice(1);
    let value: unknown = context.input;
    for (const segment of segments) {
      if (UNSAFE_PATH_SEGMENTS.has(segment)) {
        throw new Error(`Unsafe Lynx policy path segment: ${segment}`);
      }
      if (!value || typeof value !== "object") return undefined;
      value = (value as Record<string, unknown>)[segment];
    }
    return value;
  }

  /** Converts a quoted string, boolean, null, or finite number literal. */
  private parseLiteral(rawValue: string): unknown {
    const value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1);
    }
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "null") return null;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
    if (/^[A-Za-z0-9_.:/-]+$/.test(value)) return value;
    throw new Error(`Unsupported Lynx policy literal: ${rawValue}`);
  }

  /** Applies one supported comparison without implicit object coercion. */
  private compare(actual: unknown, operator: string, expected: unknown): boolean {
    if (operator === "==") return actual === expected;
    if (operator === "!=") return actual !== expected;
    if (operator === "contains") {
      if (typeof actual === "string" && typeof expected === "string") {
        return actual.includes(expected);
      }
      return Array.isArray(actual) && actual.includes(expected);
    }
    if (typeof actual !== "number" || typeof expected !== "number") {
      return false;
    }
    if (operator === ">") return actual > expected;
    if (operator === ">=") return actual >= expected;
    if (operator === "<") return actual < expected;
    if (operator === "<=") return actual <= expected;
    return false;
  }

  /** Maps a managed policy snapshot to the public SDK decision contract. */
  private toDecision(policy: LynxRuntimePolicySnapshot): LynxPolicyDecision {
    const action = this.readAction(policy.action);
    return {
      action,
      allow: action === "ALLOW" || action === "WARN",
      policyId: policy.policyId,
      policyVersion: policy.version,
      reason: policy.description ?? policy.name,
      severity: this.readSeverity(policy.severity),
      metadata: {
        managedPolicy: true,
        policyName: policy.name,
        condition: policy.condition,
      },
    };
  }

  /** Rejects unknown actions rather than silently weakening a policy. */
  private readAction(action: string): LynxPolicyAction {
    if (
      action === "ALLOW" ||
      action === "WARN" ||
      action === "BLOCK" ||
      action === "REQUIRE_APPROVAL"
    ) {
      return action;
    }
    throw new Error(`Unsupported Lynx policy action: ${action}`);
  }

  /** Narrows server severity strings to the SDK risk-level contract. */
  private readSeverity(
    severity: string,
  ): LynxToolMetadata["riskLevel"] | undefined {
    return severity === "LOW" ||
      severity === "MEDIUM" ||
      severity === "HIGH" ||
      severity === "CRITICAL"
      ? severity
      : undefined;
  }

  /** Higher-ranked actions win when multiple policies match one call. */
  private actionRank(action?: LynxPolicyAction): number {
    if (action === "BLOCK") return 5;
    if (action === "REQUIRE_APPROVAL") return 4;
    if (action === "WARN") return 2;
    return 1;
  }
}
