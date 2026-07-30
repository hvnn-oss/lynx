import type {
  LynxPolicyAction,
  LynxPolicyDecision,
  LynxRuntimePolicySnapshot,
  LynxToolMetadata,
} from "../core/types.js";

interface ToolPolicyContext {
  toolName: string;
  input?: unknown;
  output?: unknown;
  metadata: LynxToolMetadata;
  state?: {
    callCount: number;
    totalCost: number;
    elapsedMs: number;
    loopCount: number;
  };
}

const CONDITION_PATTERN =
  /^\s*(tool\.(?:name|riskLevel|sideEffect|externalTarget)|state\.(?:callCount|totalCost|elapsedMs|loopCount)|(?:input|output)(?:\.[A-Za-z0-9_-]+)*)\s*(==|!=|>=|<=|>|<|contains)\s*(.+?)\s*$/;
const UNSAFE_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

/**
 * Evaluates the intentionally small Lynx firewall expression language.
 *
 * Supported expressions compare tool metadata or nested input/output fields
 * using `==`, `!=`, numeric ordering operators, and `contains`. Arbitrary
 * JavaScript is never executed.
 */
export class LocalPolicyEvaluator {
  /** Validates one policy before a runtime bundle becomes executable. */
  validatePolicy(policy: LynxRuntimePolicySnapshot): void {
    if (
      !policy.policyId ||
      !policy.name ||
      !policy.version ||
      !policy.condition.trim()
    ) {
      throw new Error("Lynx policy metadata is incomplete");
    }
    this.validateExpression(policy.condition.trim());
    this.readAction(policy.action);
    if (this.readSeverity(policy.severity) === undefined) {
      throw new Error(`Unsupported Lynx policy severity: ${policy.severity}`);
    }
  }

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
    return this.evaluateExpression(condition.trim(), context);
  }

  /**
   * Evaluates boolean groups with `NOT` > `AND` > `OR` precedence.
   *
   * Parentheses are parsed structurally and never evaluated as JavaScript.
   */
  private evaluateExpression(
    expression: string,
    context: ToolPolicyContext,
  ): boolean {
    const normalized = this.stripOuterParentheses(expression);
    const orParts = this.splitTopLevel(normalized, "OR");
    if (orParts.length > 1) {
      return orParts.some((part) => this.evaluateExpression(part, context));
    }
    const andParts = this.splitTopLevel(normalized, "AND");
    if (andParts.length > 1) {
      return andParts.every((part) => this.evaluateExpression(part, context));
    }
    if (/^NOT\s+/i.test(normalized)) {
      return !this.evaluateExpression(
        normalized.replace(/^NOT\s+/i, ""),
        context,
      );
    }

    const parsed = CONDITION_PATTERN.exec(normalized);
    if (!parsed) {
      throw new Error(`Unsupported Lynx policy condition: ${expression}`);
    }
    const path = parsed[1]!;
    const operator = parsed[2]!;
    const rawExpected = parsed[3]!;
    const actual = this.readPath(path, context);
    const expected = this.parseLiteral(rawExpected);
    return this.compare(actual, operator, expected);
  }

  /** Parses every boolean branch without short-circuiting on runtime values. */
  private validateExpression(expression: string): void {
    const normalized = this.stripOuterParentheses(expression);
    const orParts = this.splitTopLevel(normalized, "OR");
    if (orParts.length > 1) {
      for (const part of orParts) this.validateExpression(part);
      return;
    }
    const andParts = this.splitTopLevel(normalized, "AND");
    if (andParts.length > 1) {
      for (const part of andParts) this.validateExpression(part);
      return;
    }
    if (/^NOT\s+/i.test(normalized)) {
      this.validateExpression(normalized.replace(/^NOT\s+/i, ""));
      return;
    }

    const parsed = CONDITION_PATTERN.exec(normalized);
    if (!parsed) {
      throw new Error(`Unsupported Lynx policy condition: ${expression}`);
    }
    const path = parsed[1]!;
    for (const segment of path.split(".")) {
      if (UNSAFE_PATH_SEGMENTS.has(segment)) {
        throw new Error(`Unsafe Lynx policy path segment: ${segment}`);
      }
    }
    this.parseLiteral(parsed[3]!);
  }

  /** Splits a boolean expression only at operators outside quotes and groups. */
  private splitTopLevel(expression: string, operator: "AND" | "OR"): string[] {
    const parts: string[] = [];
    let depth = 0;
    let quote: string | undefined;
    let start = 0;
    for (let index = 0; index < expression.length; index += 1) {
      const character = expression[index]!;
      if (quote) {
        if (character === quote && expression[index - 1] !== "\\")
          quote = undefined;
        continue;
      }
      if (character === "'" || character === '"') {
        quote = character;
        continue;
      }
      if (character === "(") depth += 1;
      if (character === ")") depth -= 1;
      if (depth < 0) throw new Error("Unbalanced Lynx policy parentheses");
      if (
        depth === 0 &&
        expression.slice(index).match(new RegExp(`^\\s+${operator}\\s+`, "i"))
      ) {
        const match = expression
          .slice(index)
          .match(new RegExp(`^\\s+${operator}\\s+`, "i"))!;
        parts.push(expression.slice(start, index).trim());
        index += match[0].length - 1;
        start = index + 1;
      }
    }
    if (quote || depth !== 0) throw new Error("Invalid Lynx policy grouping");
    if (parts.length === 0) return [expression];
    parts.push(expression.slice(start).trim());
    if (parts.some((part) => !part)) {
      throw new Error("Empty Lynx policy condition group");
    }
    return parts;
  }

  /** Removes one or more parenthesis pairs wrapping the entire expression. */
  private stripOuterParentheses(expression: string): string {
    let value = expression.trim();
    while (value.startsWith("(") && value.endsWith(")")) {
      let depth = 0;
      let wrapsEntireExpression = true;
      let quote: string | undefined;
      for (let index = 0; index < value.length; index += 1) {
        const character = value[index]!;
        if (quote) {
          if (character === quote && value[index - 1] !== "\\")
            quote = undefined;
          continue;
        }
        if (character === "'" || character === '"') quote = character;
        else if (character === "(") depth += 1;
        else if (character === ")") depth -= 1;
        if (depth === 0 && index < value.length - 1) {
          wrapsEntireExpression = false;
          break;
        }
      }
      if (!wrapsEntireExpression || depth !== 0) break;
      value = value.slice(1, -1).trim();
    }
    return value;
  }

  /** Resolves only allow-listed metadata and safe nested content properties. */
  private readPath(path: string, context: ToolPolicyContext): unknown {
    if (path === "tool.name") return context.toolName;
    if (path === "tool.riskLevel") return context.metadata.riskLevel;
    if (path === "tool.sideEffect") return context.metadata.sideEffect;
    if (path === "tool.externalTarget") return context.metadata.externalTarget;
    if (path === "state.callCount") return context.state?.callCount ?? 0;
    if (path === "state.totalCost") return context.state?.totalCost ?? 0;
    if (path === "state.elapsedMs") return context.state?.elapsedMs ?? 0;
    if (path === "state.loopCount") return context.state?.loopCount ?? 0;

    const [root, ...segments] = path.split(".");
    let value: unknown = root === "output" ? context.output : context.input;
    if (segments.length === 0) return value;

    // Primitive chat content uses `.value` as a stable DSL alias.
    if (
      segments.length === 1 &&
      segments[0] === "value" &&
      (value === null || typeof value !== "object")
    ) {
      return value;
    }
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
  private compare(
    actual: unknown,
    operator: string,
    expected: unknown,
  ): boolean {
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
