export type FirewallConditionValueType = "string" | "number" | "boolean";
export type FirewallConditionCombinator = "AND" | "OR";

export interface FirewallConditionRule {
  id: string;
  type: "rule";
  field: string;
  valueType: FirewallConditionValueType;
  operator: string;
  value: string;
}

export interface FirewallConditionGroup {
  id: string;
  type: "group";
  combinator: FirewallConditionCombinator;
  negated: boolean;
  children: FirewallConditionNode[];
}

export type FirewallConditionNode =
  | FirewallConditionRule
  | FirewallConditionGroup;

export const FIREWALL_CONDITION_FIELDS = [
  { value: "tool.name", type: "string" },
  { value: "tool.riskLevel", type: "string" },
  { value: "tool.sideEffect", type: "boolean" },
  { value: "tool.externalTarget", type: "string" },
  { value: "input.value", type: "string" },
  { value: "input.amount", type: "number" },
  { value: "output.value", type: "string" },
  { value: "state.callCount", type: "number" },
  { value: "state.totalCost", type: "number" },
  { value: "state.elapsedMs", type: "number" },
  { value: "state.loopCount", type: "number" },
] as const;

const CONDITION_PATTERN =
  /^\s*(tool\.(?:name|riskLevel|sideEffect|externalTarget)|state\.(?:callCount|totalCost|elapsedMs|loopCount)|(?:input|output)(?:\.[A-Za-z0-9_-]+)*)\s*(==|!=|>=|<=|>|<|contains)\s*(.+?)\s*$/;

/** 새 정책 편집기에 사용할 기본 조건 그룹을 만듭니다. */
export function createDefaultConditionGroup(): FirewallConditionGroup {
  return {
    id: createId(),
    type: "group",
    combinator: "AND",
    negated: false,
    children: [
      {
        id: createId(),
        type: "rule",
        field: "tool.riskLevel",
        valueType: "string",
        operator: "==",
        value: "CRITICAL",
      },
    ],
  };
}

/** 선택한 필드 유형에 맞는 새 조건을 만듭니다. */
export function createConditionRule(): FirewallConditionRule {
  return {
    id: createId(),
    type: "rule",
    field: "tool.name",
    valueType: "string",
    operator: "==",
    value: "",
  };
}

/** 빈 중첩 조건 그룹을 만듭니다. */
export function createConditionGroup(): FirewallConditionGroup {
  return {
    id: createId(),
    type: "group",
    combinator: "AND",
    negated: false,
    children: [createConditionRule()],
  };
}

/** 조건 빌더 모델을 SDK가 평가하는 제한 DSL 문자열로 직렬화합니다. */
export function serializeFirewallCondition(
  group: FirewallConditionGroup,
): string {
  return serializeNode(group, true);
}

/** 저장된 DSL을 조건 빌더 모델로 복원하며, 지원하지 않는 문법은 null을 반환합니다. */
export function parseFirewallCondition(
  condition: string,
): FirewallConditionGroup | null {
  try {
    const node = parseNode(condition.trim());
    if (node.type === "group") return node;
    return {
      id: createId(),
      type: "group",
      combinator: "AND",
      negated: false,
      children: [node],
    };
  } catch {
    return null;
  }
}

/** 필드 유형에 맞는 연산자 목록을 반환합니다. */
export function getFirewallConditionOperators(
  valueType: FirewallConditionValueType,
) {
  if (valueType === "number") return ["==", "!=", ">", ">=", "<", "<="];
  if (valueType === "boolean") return ["==", "!="];
  return ["==", "!=", "contains"];
}

/** 미리 정의된 필드의 값 유형을 반환합니다. */
export function getFirewallConditionFieldType(
  field: string,
): FirewallConditionValueType {
  if (field === "tool.sideEffect") return "boolean";
  if (field.startsWith("state.") || field === "input.amount") {
    return "number";
  }
  return "string";
}

function serializeNode(node: FirewallConditionNode, isRoot = false): string {
  if (node.type === "rule") {
    return `${node.field} ${node.operator} ${serializeValue(node)}`;
  }
  const body = node.children
    .map((child) => serializeNode(child))
    .join(` ${node.combinator} `);
  const grouped = isRoot && !node.negated ? body : `(${body})`;
  return node.negated ? `NOT ${grouped}` : grouped;
}

function serializeValue(rule: FirewallConditionRule): string {
  if (rule.valueType === "number") {
    const number = Number(rule.value);
    return Number.isFinite(number) ? String(number) : "0";
  }
  if (rule.valueType === "boolean") {
    return rule.value === "true" ? "true" : "false";
  }
  return `'${rule.value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}

function parseNode(expression: string): FirewallConditionNode {
  const normalized = stripOuterParentheses(expression);
  for (const combinator of ["OR", "AND"] as const) {
    const parts = splitTopLevel(normalized, combinator);
    if (parts.length > 1) {
      return {
        id: createId(),
        type: "group",
        combinator,
        negated: false,
        children: parts.map(parseNode),
      };
    }
  }

  if (/^NOT\s+/i.test(normalized)) {
    const child = parseNode(normalized.replace(/^NOT\s+/i, ""));
    const group =
      child.type === "group"
        ? child
        : {
            id: createId(),
            type: "group" as const,
            combinator: "AND" as const,
            negated: false,
            children: [child],
          };
    return { ...group, negated: !group.negated };
  }

  const parsed = CONDITION_PATTERN.exec(normalized);
  if (!parsed) throw new Error("Unsupported condition");
  const field = parsed[1]!;
  const value = parseValue(parsed[3]!);
  return {
    id: createId(),
    type: "rule",
    field,
    valueType: getFirewallConditionFieldType(field),
    operator: parsed[2]!,
    value,
  };
}

function parseValue(rawValue: string): string {
  const value = rawValue.trim();
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function splitTopLevel(
  expression: string,
  operator: FirewallConditionCombinator,
): string[] {
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
    const match =
      depth === 0
        ? expression.slice(index).match(new RegExp(`^\\s+${operator}\\s+`, "i"))
        : null;
    if (match) {
      parts.push(expression.slice(start, index).trim());
      index += match[0].length - 1;
      start = index + 1;
    }
  }
  if (quote || depth !== 0) throw new Error("Invalid grouping");
  if (parts.length === 0) return [expression];
  parts.push(expression.slice(start).trim());
  return parts;
}

function stripOuterParentheses(expression: string): string {
  let value = expression.trim();
  while (value.startsWith("(") && value.endsWith(")")) {
    let depth = 0;
    let quote: string | undefined;
    let wrapsEntireExpression = true;
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

function createId(): string {
  return Math.random().toString(36).slice(2, 10);
}
