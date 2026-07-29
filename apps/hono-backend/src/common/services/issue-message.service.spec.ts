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

  it("selects Korean only when it is the preferred language", () => {
    expect(resolveIssueLocale("ko-KR,ko;q=0.9,en;q=0.8")).toBe("ko");
    expect(resolveIssueLocale("en-US,en;q=0.9,ko;q=0.8")).toBe("en");
  });
});
