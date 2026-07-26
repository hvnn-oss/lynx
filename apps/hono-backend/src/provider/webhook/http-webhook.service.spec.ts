import { createHmac } from "node:crypto";
import { env } from "../../common/config/config.js";
import { HttpWebhookService } from "./http-webhook.service.js";

describe("HttpWebhookService", () => {
  const originalFetch = global.fetch;
  const originalSecret = env.FIREWALL_WEBHOOK_SIGNING_SECRET;

  afterEach(() => {
    global.fetch = originalFetch;
    env.FIREWALL_WEBHOOK_SIGNING_SECRET = originalSecret;
  });

  it("타임스탬프와 본문을 HMAC으로 서명해 전송한다", async () => {
    env.FIREWALL_WEBHOOK_SIGNING_SECRET = "test-webhook-secret-value";
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
      }),
    );
    global.fetch = fetchMock;
    const event = {
      id: "event-1",
      type: "firewall.blocked" as const,
      occurredAt: "2026-07-25T00:00:00.000Z",
      workspaceId: "workspace-1",
      data: { action: "BLOCK" },
    };

    await new HttpWebhookService().send(
      "https://hooks.example.com/lynx",
      event,
    );

    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    const expected = createHmac("sha256", "test-webhook-secret-value")
      .update(`${headers["X-Lynx-Timestamp"]}.${init.body}`, "utf8")
      .digest("hex");
    expect(headers["X-Lynx-Signature"]).toBe(`sha256=${expected}`);
    expect(headers["X-Lynx-Event"]).toBe("firewall.blocked");
  });

  it("기본 설정에서는 사설 네트워크 목적지를 거절한다", async () => {
    await expect(
      new HttpWebhookService().send("https://127.0.0.1/hook", {
        id: "event-1",
        type: "firewall.blocked",
        occurredAt: "2026-07-25T00:00:00.000Z",
        workspaceId: "workspace-1",
        data: {},
      }),
    ).rejects.toThrow("FIREWALL_WEBHOOK_PRIVATE_NETWORK_NOT_ALLOWED");
  });
});
