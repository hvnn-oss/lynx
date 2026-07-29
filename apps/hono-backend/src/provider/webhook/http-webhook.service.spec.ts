import { createHmac } from "node:crypto";
import { env } from "../../common/config/config.js";
import {
  HttpWebhookService,
  WebhookRequestError,
} from "./http-webhook.service.js";

describe("HttpWebhookService", () => {
  const originalFetch = global.fetch;
  const originalSecret = env.FIREWALL_WEBHOOK_SIGNING_SECRET;
  const originalAllowPrivateNetwork =
    env.FIREWALL_WEBHOOK_ALLOW_PRIVATE_NETWORK;
  const originalNodeEnv = env.NODE_ENV;

  afterEach(() => {
    global.fetch = originalFetch;
    env.FIREWALL_WEBHOOK_SIGNING_SECRET = originalSecret;
    env.FIREWALL_WEBHOOK_ALLOW_PRIVATE_NETWORK =
      originalAllowPrivateNetwork;
    env.NODE_ENV = originalNodeEnv;
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

    const result = await new HttpWebhookService(async () => ["8.8.8.8"]).send(
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
    expect(headers["X-Lynx-Delivery"]).toBe("event-1");
    expect(result).toEqual({ statusCode: 204 });
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

  it("IPv6 링크 로컬과 CGNAT처럼 공개 인터넷이 아닌 주소를 거절한다", async () => {
    const event = {
      id: "event-1",
      type: "firewall.blocked" as const,
      occurredAt: "2026-07-25T00:00:00.000Z",
      workspaceId: "workspace-1",
      data: {},
    };

    await expect(
      new HttpWebhookService().send("https://[fe90::1]/hook", event),
    ).rejects.toThrow("FIREWALL_WEBHOOK_PRIVATE_NETWORK_NOT_ALLOWED");
    await expect(
      new HttpWebhookService().send("https://100.64.0.1/hook", event),
    ).rejects.toThrow("FIREWALL_WEBHOOK_PRIVATE_NETWORK_NOT_ALLOWED");
  });

  it("DNS가 사설 주소를 반환하면 외부 호스트 이름도 거절한다", async () => {
    await expect(
      new HttpWebhookService(async () => ["10.0.0.8"]).send(
        "https://hooks.example.com/lynx",
        {
          id: "event-1",
          type: "firewall.blocked",
          occurredAt: "2026-07-25T00:00:00.000Z",
          workspaceId: "workspace-1",
          data: {},
        },
      ),
    ).rejects.toMatchObject({
      retryable: false,
      message: "FIREWALL_WEBHOOK_PRIVATE_NETWORK_NOT_ALLOWED",
    });
  });

  it("서버 오류는 재시도 가능하고 일반 클라이언트 오류는 최종 실패로 분류한다", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 400 }));
    const service = new HttpWebhookService(async () => ["8.8.8.8"]);
    const event = {
      id: "event-1",
      type: "webhook.test" as const,
      occurredAt: "2026-07-25T00:00:00.000Z",
      workspaceId: "workspace-1",
      data: {},
    };

    const serverError = await service
      .send("https://hooks.example.com/lynx", event)
      .catch((error) => error);
    const clientError = await service
      .send("https://hooks.example.com/lynx", event)
      .catch((error) => error);

    expect(serverError).toBeInstanceOf(WebhookRequestError);
    expect(serverError).toMatchObject({ retryable: true, statusCode: 503 });
    expect(clientError).toMatchObject({ retryable: false, statusCode: 400 });
  });

  it("운영 환경의 HTTP URL과 URL 내 인증 정보를 거절한다", async () => {
    env.NODE_ENV = "production";
    const service = new HttpWebhookService(async () => ["8.8.8.8"]);
    const event = {
      id: "event-1",
      type: "webhook.test" as const,
      occurredAt: "2026-07-25T00:00:00.000Z",
      workspaceId: "workspace-1",
      data: {},
    };

    await expect(
      service.send("http://hooks.example.com/lynx", event),
    ).rejects.toMatchObject({
      retryable: false,
      message: "FIREWALL_WEBHOOK_URL_NOT_ALLOWED",
    });
    await expect(
      service.send("https://user:password@hooks.example.com/lynx", event),
    ).rejects.toMatchObject({
      retryable: false,
      message: "FIREWALL_WEBHOOK_CREDENTIALS_NOT_ALLOWED",
    });
    expect(global.fetch).toBe(originalFetch);
  });

  it("네트워크 오류를 재시도 가능한 실패로 변환한다", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("connection reset"));

    await expect(
      new HttpWebhookService(async () => ["8.8.8.8"]).send(
        "https://hooks.example.com/lynx",
        {
          id: "event-1",
          type: "webhook.test",
          occurredAt: "2026-07-25T00:00:00.000Z",
          workspaceId: "workspace-1",
          data: {},
        },
      ),
    ).rejects.toMatchObject({
      retryable: true,
      statusCode: null,
      message: expect.stringContaining("FIREWALL_WEBHOOK_NETWORK_ERROR"),
    });
  });

  it("429 Retry-After 값을 재시도 지연 시간으로 보존한다", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(null, {
        status: 429,
        headers: { "Retry-After": "12" },
      }),
    );

    await expect(
      new HttpWebhookService(async () => ["8.8.8.8"]).send(
        "https://hooks.example.com/lynx",
        {
          id: "event-1",
          type: "webhook.test",
          occurredAt: "2026-07-25T00:00:00.000Z",
          workspaceId: "workspace-1",
          data: {},
        },
      ),
    ).rejects.toMatchObject({
      retryable: true,
      statusCode: 429,
      retryAfterMs: 12_000,
    });
  });

  it("명시적으로 허용하면 온프레미스 사설 주소로도 전송한다", async () => {
    env.FIREWALL_WEBHOOK_ALLOW_PRIVATE_NETWORK = true;
    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      new HttpWebhookService().send("https://10.0.0.8/lynx", {
        id: "event-1",
        type: "webhook.test",
        occurredAt: "2026-07-25T00:00:00.000Z",
        workspaceId: "workspace-1",
        data: {},
      }),
    ).resolves.toEqual({ statusCode: 204 });
  });
});
