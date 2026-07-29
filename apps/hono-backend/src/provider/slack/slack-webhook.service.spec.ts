import { SlackWebhookService } from "./slack-webhook.service.js";
import { WebhookRequestError } from "../webhook/http-webhook.service.js";

describe("SlackWebhookService", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("Slack Block Kit payload를 공식 Incoming Webhook 호스트로 전송한다", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(new Response("ok", { status: 200 }));
    global.fetch = fetchMock;

    const result = await new SlackWebhookService().send(
      "https://hooks.slack.com/services/T000/B000/secret",
      {
        id: "event-1",
        type: "firewall.blocked",
        occurredAt: "2026-07-28T00:00:00.000Z",
        workspaceId: "workspace-1",
        data: { toolName: "deleteFile", reason: "Destructive tool" },
      },
    );

    const request = fetchMock.mock.calls[0]![1] as RequestInit;
    const payload = JSON.parse(String(request.body)) as {
      text: string;
      blocks: unknown[];
    };
    expect(result).toEqual({ statusCode: 200 });
    expect(payload.text).toContain("deleteFile");
    expect(payload.blocks.length).toBeGreaterThan(2);
  });

  it("Slack 이외의 목적지와 URL query를 거절한다", async () => {
    const service = new SlackWebhookService();
    const event = {
      id: "event-1",
      type: "slack.test" as const,
      occurredAt: "2026-07-28T00:00:00.000Z",
      workspaceId: "workspace-1",
      data: {},
    };

    await expect(
      service.send("https://example.com/services/T/B/secret", event),
    ).rejects.toThrow("SLACK_WEBHOOK_URL_NOT_ALLOWED");
    await expect(
      service.send(
        "https://hooks.slack.com/services/T/B/secret?token=leak",
        event,
      ),
    ).rejects.toThrow("SLACK_WEBHOOK_URL_NOT_ALLOWED");
  });

  it("429와 서버 오류만 재시도 가능한 실패로 분류한다", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response("rate_limited", {
          status: 429,
          headers: { "Retry-After": "3" },
        }),
      )
      .mockResolvedValueOnce(new Response("invalid_token", { status: 403 }));
    const service = new SlackWebhookService();
    const event = {
      id: "event-1",
      type: "slack.test" as const,
      occurredAt: "2026-07-28T00:00:00.000Z",
      workspaceId: "workspace-1",
      data: {},
    };

    const retryable = await service
      .send("https://hooks.slack.com/services/T/B/secret", event)
      .catch((error) => error);
    const permanent = await service
      .send("https://hooks.slack.com/services/T/B/secret", event)
      .catch((error) => error);

    expect(retryable).toBeInstanceOf(WebhookRequestError);
    expect(retryable).toMatchObject({
      retryable: true,
      statusCode: 429,
      retryAfterMs: 3_000,
    });
    expect(permanent).toMatchObject({ retryable: false, statusCode: 403 });
  });

  it("네트워크 오류를 재시도 가능한 Slack 전송 실패로 변환한다", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("socket closed"));

    await expect(
      new SlackWebhookService().send(
        "https://hooks.slack.com/services/T/B/secret",
        {
          id: "event-1",
          type: "slack.test",
          occurredAt: "2026-07-28T00:00:00.000Z",
          workspaceId: "workspace-1",
          data: {},
        },
      ),
    ).rejects.toMatchObject({
      retryable: true,
      message: expect.stringContaining("SLACK_WEBHOOK_NETWORK_ERROR"),
    });
  });

  it("성공 상태라도 Slack 응답 본문이 ok가 아니면 최종 실패로 처리한다", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response("invalid_payload", { status: 200 }));

    await expect(
      new SlackWebhookService().send(
        "https://hooks.slack.com/services/T/B/secret",
        {
          id: "event-1",
          type: "slack.test",
          occurredAt: "2026-07-28T00:00:00.000Z",
          workspaceId: "workspace-1",
          data: {},
        },
      ),
    ).rejects.toMatchObject({
      retryable: false,
      statusCode: 200,
      message: "SLACK_WEBHOOK_UNEXPECTED_RESPONSE",
    });
  });

  it("Slack Gov Incoming Webhook 호스트도 허용한다", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response("ok", { status: 200 }));

    await expect(
      new SlackWebhookService().send(
        "https://hooks.slack-gov.com/services/T/B/secret",
        {
          id: "event-1",
          type: "slack.test",
          occurredAt: "2026-07-28T00:00:00.000Z",
          workspaceId: "workspace-1",
          data: {},
        },
      ),
    ).resolves.toEqual({ statusCode: 200 });
  });
});
