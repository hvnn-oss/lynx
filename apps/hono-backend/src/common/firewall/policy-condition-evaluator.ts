interface PolicySimulationContext {
  tool: {
    name: string;
    riskLevel?: string;
    sideEffect?: boolean;
    externalTarget?: string;
  };
  input?: unknown;
  state?: {
    callCount: number;
    totalCost: number;
    elapsedMs: number;
    loopCount: number;
  };
}

const CONDITION_PATTERN =
  /^\s*(tool\.(?:name|riskLevel|sideEffect|externalTarget)|state\.(?:callCount|totalCost|elapsedMs|loopCount)|input(?:\.[A-Za-z0-9_-]+)*)\s*(==|!=|>=|<=|>|<|contains)\s*(.+?)\s*$/;
const UNSAFE_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

/** SDK와 동일한 제한된 조건 문법을 서버에서 안전하게 평가합니다. */
export class PolicyConditionEvaluator {
  /** 정책 조건 한 개가 주어진 도구 호출과 일치하는지 반환합니다. */
  matches(condition: string, context: PolicySimulationContext): boolean {
    return this.evaluateExpression(condition.trim(), context);
  }

  /** 괄호와 NOT, AND, OR 우선순위를 적용해 조건 그룹을 평가합니다. */
  private evaluateExpression(
    expression: string,
    context: PolicySimulationContext,
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
    const actual = this.readPath(parsed[1]!, context);
    const expected = this.parseLiteral(parsed[3]!);
    return this.compare(actual, parsed[2]!, expected);
  }

  /** 따옴표와 괄호 밖에 있는 논리 연산자만 기준으로 분리합니다. */
  private splitTopLevel(expression: string, operator: "AND" | "OR"): string[] {
    const parts: string[] = [];
    let depth = 0;
    let quote: string | undefined;
    let start = 0;
    for (let index = 0; index < expression.length; index += 1) {
      const character = expression[index]!;
      if (quote) {
        if (character === quote && expression[index - 1] !== "\\") {
          quote = undefined;
        }
        continue;
      }
      if (character === "'" || character === '"') {
        quote = character;
        continue;
      }
      if (character === "(") depth += 1;
      if (character === ")") depth -= 1;
      if (depth < 0) throw new Error("Unbalanced Lynx policy parentheses");
      const match =
        depth === 0
          ? expression
              .slice(index)
              .match(new RegExp(`^\\s+${operator}\\s+`, "i"))
          : null;
      if (match) {
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

  /** 전체 표현식을 감싸는 바깥 괄호만 제거합니다. */
  private stripOuterParentheses(expression: string): string {
    let value = expression.trim();
    while (value.startsWith("(") && value.endsWith(")")) {
      let depth = 0;
      let wrapsEntireExpression = true;
      let quote: string | undefined;
      for (let index = 0; index < value.length; index += 1) {
        const character = value[index]!;
        if (quote) {
          if (character === quote && value[index - 1] !== "\\") {
            quote = undefined;
          }
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

  /** 허용된 도구 메타데이터와 안전한 입력 경로만 읽습니다. */
  private readPath(path: string, context: PolicySimulationContext): unknown {
    if (path === "tool.name") return context.tool.name;
    if (path === "tool.riskLevel") return context.tool.riskLevel;
    if (path === "tool.sideEffect") return context.tool.sideEffect;
    if (path === "tool.externalTarget") return context.tool.externalTarget;
    if (path === "state.callCount") return context.state?.callCount ?? 0;
    if (path === "state.totalCost") return context.state?.totalCost ?? 0;
    if (path === "state.elapsedMs") return context.state?.elapsedMs ?? 0;
    if (path === "state.loopCount") return context.state?.loopCount ?? 0;

    let value: unknown = context.input;
    for (const segment of path.split(".").slice(1)) {
      if (UNSAFE_PATH_SEGMENTS.has(segment)) {
        throw new Error(`Unsafe Lynx policy path segment: ${segment}`);
      }
      if (!value || typeof value !== "object") return undefined;
      value = (value as Record<string, unknown>)[segment];
    }
    return value;
  }

  /** 문자열, 불리언, null, 유한 숫자 리터럴만 해석합니다. */
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

  /** 객체 강제 변환 없이 SDK가 지원하는 비교 연산만 수행합니다. */
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
    if (typeof actual !== "number" || typeof expected !== "number")
      return false;
    if (operator === ">") return actual > expected;
    if (operator === ">=") return actual >= expected;
    if (operator === "<") return actual < expected;
    if (operator === "<=") return actual <= expected;
    return false;
  }
}
