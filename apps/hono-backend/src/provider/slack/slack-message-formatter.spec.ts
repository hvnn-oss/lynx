import { SlackMessageFormatter } from "./slack-message-formatter.js";

const occurredAt = "2026-07-29T00:00:00.000Z";
const workspaceId = "8bf8d2a6-962e-4c73-8f51-05ec4b427fd8";

describe("SlackMessageFormatter", () => {
  const formatter = new SlackMessageFormatter();

  it("차단 알림에 Tool, Agent, Run과 대시보드 링크를 포함한다", () => {
    const payload = formatter.format({
      id: "event-1",
      type: "firewall.blocked",
      occurredAt,
      workspaceId,
      data: {
        toolName: "delete_user",
        reason: "Destructive action",
        agentId: "support-agent",
        runId: "run/with space",
      },
    });

    expect(payload.text).toContain("delete_user");
    expect(JSON.stringify(payload.blocks)).toContain("support-agent");
    expect(JSON.stringify(payload.blocks)).toContain("Destructive action");
    expect(JSON.stringify(payload.blocks)).toContain(
      "/dashboard/session/detail/run%2Fwith%20space",
    );
  });

  it("사용자 입력을 Slack mrkdwn에서 안전하게 이스케이프한다", () => {
    const payload = formatter.format({
      id: "event-1",
      type: "firewall.blocked",
      occurredAt,
      workspaceId,
      data: {
        toolName: "<script>&tool",
        reason: "<!channel> & unsafe",
      },
    });
    const serialized = JSON.stringify(payload.blocks);

    expect(serialized).toContain("&lt;script&gt;&amp;tool");
    expect(serialized).toContain("&lt;!channel&gt; &amp; unsafe");
    expect(serialized).not.toContain("<!channel>");
  });

  it("승인 요청에는 만료 시각과 승인 화면 링크를 포함한다", () => {
    const payload = formatter.format({
      id: "event-2",
      type: "approval.requested",
      occurredAt,
      workspaceId,
      data: {
        approvalId: "approval-1",
        toolName: "send_payment",
        agentId: "finance-agent",
        runId: "run-1",
        expiresAt: "2026-07-29T00:05:00.000Z",
      },
    });
    const serialized = JSON.stringify(payload.blocks);

    expect(payload.text).toContain("send_payment");
    expect(serialized).toContain("approval-1");
    expect(serialized).toContain("2026-07-29T00:05:00.000Z");
    expect(serialized).toContain("/firewall/approvals");
  });

  it("승인 결정과 연결 테스트를 각각 구분해 표시한다", () => {
    const decision = formatter.format({
      id: "event-3",
      type: "approval.decided",
      occurredAt,
      workspaceId,
      data: {
        status: "REJECTED",
        toolName: "send_payment",
        decisionReason: "Amount is too high",
      },
    });
    const test = formatter.format({
      id: "event-4",
      type: "slack.test",
      occurredAt,
      workspaceId,
      data: { displayName: "#lynx-alerts" },
    });

    expect(decision.text).toContain("rejected");
    expect(JSON.stringify(decision.blocks)).toContain("Amount is too high");
    expect(test.text).toBe("Lynx Slack integration test succeeded.");
    expect(JSON.stringify(test.blocks)).toContain("#lynx-alerts");
  });
});
