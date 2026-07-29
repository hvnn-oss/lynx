export type IssueLocale = "en" | "ko";

export interface IssueMessageDescriptor {
  titleKey: string;
  summaryKey: string;
  params: Record<string, unknown>;
}

export interface RenderedIssueMessage {
  title: string;
  summary: string;
}

const MAX_TITLE_LENGTH = 255;
const MAX_DESCRIPTOR_LENGTH = 120;

/** HTTP 언어 헤더에서 현재 지원하는 이슈 표시 언어를 선택합니다. */
export function resolveIssueLocale(
  acceptLanguage: string | undefined,
): IssueLocale {
  const preferred = acceptLanguage
    ?.split(",")
    .map((item) => item.trim().split(";")[0]?.toLowerCase())
    .find(Boolean);
  return preferred === "ko" || preferred?.startsWith("ko-") ? "ko" : "en";
}

/** 언어 중립적인 메시지 키와 파라미터를 화면용 제목과 요약으로 변환합니다. */
export function renderIssueMessage(
  message: IssueMessageDescriptor | null | undefined,
  locale: IssueLocale,
  fallback?: RenderedIssueMessage,
): RenderedIssueMessage {
  if (!message) {
    return (
      fallback ?? {
        title: locale === "ko" ? "에이전트 이슈 감지" : "Agent issue detected",
        summary:
          locale === "ko"
            ? "에이전트 실행에서 검토가 필요한 문제가 감지되었습니다."
            : "An agent execution reported an issue that requires review.",
      }
    );
  }

  const rendered = renderKnownMessage(message, locale);
  return rendered ?? fallback ?? renderUnknownMessage(message, locale);
}

function renderKnownMessage(
  message: IssueMessageDescriptor,
  locale: IssueLocale,
): RenderedIssueMessage | null {
  const toolName = readText(message.params.toolName) ?? "agent action";
  const condition = createConditionDescriptor(message.params, locale);

  if (message.titleKey === "issue.firewall.block.title") {
    return {
      title: truncate(
        locale === "ko"
          ? `${toolName} 호출 차단 — ${condition}`
          : `${toolName} blocked — ${condition}`,
        MAX_TITLE_LENGTH,
      ),
      summary:
        locale === "ko"
          ? `SDK 방화벽이 ${condition} 조건에 해당하는 ${toolName} 호출을 차단했습니다.`
          : `The SDK firewall blocked ${toolName} because it matched ${condition}.`,
    };
  }

  if (message.titleKey === "issue.firewall.warn.title") {
    return {
      title: truncate(
        locale === "ko"
          ? `${toolName} 위험 감지 — ${condition}`
          : `Risk detected for ${toolName} — ${condition}`,
        MAX_TITLE_LENGTH,
      ),
      summary:
        locale === "ko"
          ? `SDK 방화벽이 ${condition} 조건에 해당하는 ${toolName} 호출을 감지했습니다.`
          : `The SDK firewall detected that ${toolName} matched ${condition}.`,
    };
  }

  if (message.titleKey === "issue.loop.detected.title") {
    const label =
      readText(message.params.label) ??
      readText(message.params.eventType) ??
      (locale === "ko" ? "에이전트 행동" : "agent action");
    const loopCount = readNumber(message.params.loopCount);
    const countLabel = loopCount
      ? locale === "ko"
        ? `${loopCount}회`
        : `${loopCount} times`
      : locale === "ko"
        ? "반복"
        : "repeated";
    return {
      title: truncate(
        locale === "ko"
          ? `${label} 반복 감지 — ${countLabel}`
          : `Repeated ${label} detected — ${countLabel}`,
        MAX_TITLE_LENGTH,
      ),
      summary:
        locale === "ko"
          ? `한 번의 실행에서 ${label} 행동이 ${countLabel} 감지되었습니다.`
          : `${label} was detected ${countLabel} in one execution.`,
    };
  }

  if (message.titleKey === "issue.prompt.regression.title") {
    return {
      title:
        locale === "ko"
          ? "프롬프트 버전 성능 회귀 감지"
          : "Prompt version performance regressed",
      summary:
        locale === "ko"
          ? "배포된 프롬프트 버전이 설정된 성공률, 오류율 또는 비용 회귀 임계값을 벗어났습니다."
          : "The deployed prompt version crossed a configured success, error, or cost regression threshold.",
    };
  }

  return null;
}

/** 정책 이름을 우선 사용하고 없으면 안전하게 축약한 조건 또는 사유를 사용합니다. */
function createConditionDescriptor(
  params: Record<string, unknown>,
  locale: IssueLocale,
): string {
  const policyName = readText(params.policyName);
  const condition = readText(params.condition);
  const conditionSummary = condition
    ? summarizeCondition(condition, locale)
    : undefined;
  if (policyName && conditionSummary) {
    return truncate(
      locale === "ko"
        ? `‘${policyName}’ 정책 (${conditionSummary})`
        : `“${policyName}” policy (${conditionSummary})`,
      MAX_DESCRIPTOR_LENGTH,
    );
  }
  if (policyName) {
    return truncate(
      locale === "ko" ? `‘${policyName}’ 정책` : `“${policyName}” policy`,
      MAX_DESCRIPTOR_LENGTH,
    );
  }
  if (conditionSummary) return truncate(conditionSummary, MAX_DESCRIPTOR_LENGTH);

  const reason = readText(params.reason);
  if (reason) return truncate(reason, MAX_DESCRIPTOR_LENGTH);
  return locale === "ko" ? "방화벽 정책 조건" : "firewall policy condition";
}

/** 지원 DSL의 흔한 필드명을 짧은 사용자 문장으로 치환합니다. */
function summarizeCondition(condition: string, locale: IssueLocale): string {
  const labels: Record<string, [string, string]> = {
    "tool.name": ["도구 이름", "tool name"],
    "tool.riskLevel": ["도구 위험도", "tool risk level"],
    "tool.sideEffect": ["부작용 여부", "side effect"],
    "tool.externalTarget": ["외부 대상", "external target"],
    "state.callCount": ["호출 횟수", "call count"],
    "state.totalCost": ["누적 비용", "total cost"],
    "state.elapsedMs": ["경과 시간(ms)", "elapsed time (ms)"],
    "state.loopCount": ["반복 횟수", "loop count"],
  };
  let result = condition;
  for (const [field, [ko, en]] of Object.entries(labels)) {
    result = result.replaceAll(field, locale === "ko" ? ko : en);
  }
  return result
    .replaceAll("==", "=")
    .replace(/\s+/g, " ")
    .trim();
}

function renderUnknownMessage(
  message: IssueMessageDescriptor,
  locale: IssueLocale,
): RenderedIssueMessage {
  return {
    title:
      locale === "ko" ? "에이전트 이슈 감지" : "Agent issue detected",
    summary:
      locale === "ko"
        ? `${message.summaryKey} 유형의 문제가 감지되었습니다.`
        : `An issue of type ${message.summaryKey} was detected.`,
  };
}

function readText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function truncate(value: string, maximum: number): string {
  return value.length <= maximum
    ? value
    : `${value.slice(0, Math.max(0, maximum - 1)).trimEnd()}…`;
}
