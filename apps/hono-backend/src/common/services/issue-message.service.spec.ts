import {
  renderIssueMessage,
  resolveIssueLocale,
} from "./issue-message.service.js";

describe("issue message rendering", () => {
  const message = {
    titleKey: "issue.firewall.block.title",
    summaryKey: "issue.firewall.block.summary",
    params: {
      toolName: "deleteFile",
      policyName: "Block destructive tools",
      condition: "tool.riskLevel == HIGH",
    },
  };

  it("renders the blocked tool and condition in Korean", () => {
    expect(renderIssueMessage(message, "ko")).toEqual({
      title:
        "deleteFile 호출 차단 — ‘Block destructive tools’ 정책 (도구 위험도 = HIGH)",
      summary:
        "SDK 방화벽이 ‘Block destructive tools’ 정책 (도구 위험도 = HIGH) 조건에 해당하는 deleteFile 호출을 차단했습니다.",
    });
  });

  it("renders the same structured message in English", () => {
    expect(renderIssueMessage(message, "en")).toEqual({
      title:
        "deleteFile blocked — “Block destructive tools” policy (tool risk level = HIGH)",
      summary:
        "The SDK firewall blocked deleteFile because it matched “Block destructive tools” policy (tool risk level = HIGH).",
    });
  });

  it("renders tool errors without exposing the raw error message", () => {
    const toolError = {
      titleKey: "issue.tool.error.title",
      summaryKey: "issue.tool.error.summary",
      params: {
        toolName: "orders.lookup",
        errorCode: "ECONNRESET",
        errorMessage: "customer secret must not be rendered",
      },
    };

    expect(renderIssueMessage(toolError, "en")).toEqual({
      title: "orders.lookup failed — ECONNRESET",
      summary: "orders.lookup raised ECONNRESET before returning a result.",
    });
  });

  it("renders tool timeouts in Korean", () => {
    const toolTimeout = {
      titleKey: "issue.tool.timeout.title",
      summaryKey: "issue.tool.timeout.summary",
      params: {
        toolName: "reports.generate",
        timeoutMs: 5_000,
      },
    };

    expect(renderIssueMessage(toolTimeout, "ko")).toEqual({
      title: "reports.generate 응답 시간 초과",
      summary:
        "reports.generate 도구가 5000ms 안에 결과를 반환하지 않았습니다.",
    });
  });

  it("renders unhandled run errors without exposing the raw message", () => {
    const runError = {
      titleKey: "issue.run.error.title",
      summaryKey: "issue.run.error.summary",
      params: {
        agentName: "SupportAgent",
        errorCode: "E_HANDLER",
        errorMessage: "customer secret must not be rendered",
      },
    };

    expect(renderIssueMessage(runError, "en")).toEqual({
      title: "SupportAgent run failed — E_HANDLER",
      summary:
        "SupportAgent ended because the unhandled E_HANDLER error was rethrown.",
    });
  });

  it("renders explicit failed outcomes in Korean", () => {
    const failedOutcome = {
      titleKey: "issue.run.failed.title",
      summaryKey: "issue.run.failed.summary",
      params: {
        agentName: "SupportAgent",
        businessStatus: "FAILED",
      },
    };

    expect(renderIssueMessage(failedOutcome, "ko")).toEqual({
      title: "SupportAgent 실패 결과 보고",
      summary:
        "SupportAgent 실행의 기술 또는 업무 결과가 실패로 기록되었습니다 (FAILED).",
    });
  });

  it("renders LLM errors and slow responses", () => {
    expect(
      renderIssueMessage(
        {
          titleKey: "issue.llm.error.title",
          summaryKey: "issue.llm.error.summary",
          params: {
            model: "gpt-test",
            errorCode: "RATE_LIMIT",
          },
        },
        "en",
      ),
    ).toEqual({
      title: "gpt-test call failed — RATE_LIMIT",
      summary:
        "gpt-test raised RATE_LIMIT before completing its response.",
    });
    expect(
      renderIssueMessage(
        {
          titleKey: "issue.llm.slow.title",
          summaryKey: "issue.llm.slow.summary",
          params: {
            model: "gpt-test",
            latency: 12_000,
            thresholdMs: 10_000,
            consecutiveOccurrences: 2,
          },
        },
        "ko",
      ),
    ).toEqual({
      title: "gpt-test 응답 지연 — 12000ms",
      summary: "gpt-test 호출이 10000ms 기준을 2회 연속 초과했습니다.",
    });
  });

  it("selects Korean only when it is the preferred language", () => {
    expect(resolveIssueLocale("ko-KR,ko;q=0.9,en;q=0.8")).toBe("ko");
    expect(resolveIssueLocale("en-US,en;q=0.9,ko;q=0.8")).toBe("en");
  });
});
