interface PolicySimulationContext {
  tool: {
    name: string;
    riskLevel?: string;
    sideEffect?: boolean;
    externalTarget?: string;
  };
  input?: unknown;
  output?: unknown;
  state?: {
    callCount: number;
    totalCost: number;
    elapsedMs: number;
    loopCount: number;
  };
}

export interface PolicyConditionTrace {
  expression: string;
  field: string;
  operator: string;
  expected: unknown;
  actual: unknown;
  matched: boolean;
  negated: boolean;
}

export interface PolicyConditionEvaluation {
  matched: boolean;
  conditions: PolicyConditionTrace[];
}

const CONDITION_PATTERN =
  /^\s*(tool\.(?:name|riskLevel|sideEffect|externalTarget)|state\.(?:callCount|totalCost|elapsedMs|loopCount)|(?:input|output)(?:\.[A-Za-z0-9_-]+)*)\s*(==|!=|>=|<=|>|<|contains)\s*(.+?)\s*$/;
const UNSAFE_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

/** SDK와 같은 제한된 조건 문법을 서버에서 안전하게 평가합니다. */
export class PolicyConditionEvaluator {
  /** 정책 조건이 주어진 도구 호출과 일치하는지 반환합니다. */
  matches(condition: string, context: PolicySimulationContext): boolean {
    return this.evaluate(condition, context).matched;
  }

  /** 최종 판단과 각 원자 조건의 비교 결과를 함께 반환합니다. */
  evaluate(
    condition: string,
    context: PolicySimulationContext,
  ): PolicyConditionEvaluation {
    return this.evaluateExpression(condition.trim(), context);
  }

  /** 괄호와 NOT, AND, OR 우선순위를 적용해 조건 그룹을 평가합니다. */
  private evaluateExpression(
    expression: string,
    context: PolicySimulationContext,
  ): PolicyConditionEvaluation {
    const normalized = this.stripOuterParentheses(expression);
    const orParts = this.splitTopLevel(normalized, "OR");
    if (orParts.length > 1) {
      const results = orParts.map((part) =>
        this.evaluateExpression(part, context),
      );
      return {
        matched: results.some((result) => result.matched),
        conditions: results.flatMap((result) => result.conditions),
      };
    }

    const andParts = this.splitTopLevel(normalized, "AND");
    if (andParts.length > 1) {
      const results = andParts.map((part) =>
        this.evaluateExpression(part, context),
      );
      return {
        matched: results.every((result) => result.matched),
        conditions: results.flatMap((result) => result.conditions),
      };
    }

    if (/^NOT\s+/i.test(normalized)) {
      const result = this.evaluateExpression(
        normalized.replace(/^NOT\s+/i, ""),
        context,
      );
      return {
        matched: !result.matched,
        conditions: result.conditions.map((condition) => ({
          ...condition,
          matched: !condition.matched,
          negated: !condition.negated,
        })),
      };
    }

    const parsed = CONDITION_PATTERN.exec(normalized);
    if (!parsed) {
      throw new Error(`Unsupported Lynx policy condition: ${expression}`);
    }

    const actual = this.readPath(parsed[1]!, context);
    const expected = this.parseLiteral(parsed[3]!);
    const matched = this.compare(actual, parsed[2]!, expected);
    return {
      matched,
      conditions: [
        {
          expression: normalized,
          field: parsed[1]!,
          operator: parsed[2]!,
          expected,
          actual: actual ?? null,
          matched,
          negated: false,
        },
      ],
    };
  }

  /** 중첩된 괄호 밖의 논리 연산자만 기준으로 분리합니다. */
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

  /** 전체 표현식을 감싸는 가장 바깥 괄호만 제거합니다. */
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

    const [root, ...segments] = path.split(".");
    let value: unknown = root === "output" ? context.output : context.input;
    if (segments.length === 0) return value;

    // 문자열 본문은 input.value/output.value라는 공통 경로로 평가합니다.
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
    if (typeof actual !== "number" || typeof expected !== "number") {
      return false;
    }
    if (operator === ">") return actual > expected;
    if (operator === ">=") return actual >= expected;
    if (operator === "<") return actual < expected;
    if (operator === "<=") return actual <= expected;
    return false;
  }
}
