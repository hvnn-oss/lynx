import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import { env } from "../../common/config/config.js";
import {
  executePinnedRequest,
  HttpWebhookService,
  type WebhookRequestExecutor,
  WebhookRequestError,
} from "./http-webhook.service.js";

const event = {
  id: "event-1",
  type: "firewall.blocked" as const,
  occurredAt: "2026-07-25T00:00:00.000Z",
  workspaceId: "workspace-1",
  data: { action: "BLOCK" },
};

function successfulRequest() {
  return jest
    .fn<WebhookRequestExecutor>()
    .mockResolvedValue({ statusCode: 204, retryAfter: null });
}

describe("HttpWebhookService", () => {
  const originalSecret = env.FIREWALL_WEBHOOK_SIGNING_SECRET;
  const originalAllowPrivateNetwork =
    env.FIREWALL_WEBHOOK_ALLOW_PRIVATE_NETWORK;
  const originalNodeEnv = env.NODE_ENV;

  afterEach(() => {
    env.FIREWALL_WEBHOOK_SIGNING_SECRET = originalSecret;
    env.FIREWALL_WEBHOOK_ALLOW_PRIVATE_NETWORK = originalAllowPrivateNetwork;
    env.NODE_ENV = originalNodeEnv;
  });

  it("본문을 서명하고 DNS에서 검증한 IP를 실제 요청에 고정한다", async () => {
    env.FIREWALL_WEBHOOK_SIGNING_SECRET = "test-webhook-secret-value";
    const request = successfulRequest();

    const result = await new HttpWebhookService(
      async () => ["8.8.8.8"],
      request,
    ).send("https://hooks.example.com/lynx", event);

    const input = request.mock.calls[0]![0];
    const expected = createHmac("sha256", "test-webhook-secret-value")
      .update(`${input.headers["X-Lynx-Timestamp"]}.${input.body}`, "utf8")
      .digest("hex");
    expect(input.resolvedAddress).toBe("8.8.8.8");
    expect(input.destination.hostname).toBe("hooks.example.com");
    expect(input.headers["X-Lynx-Signature"]).toBe(`sha256=${expected}`);
    expect(input.headers["X-Lynx-Delivery"]).toBe("event-1");
    expect(result).toEqual({ statusCode: 204 });
  });

  it("검사 뒤 DNS가 바뀌어도 executor에는 처음 검증한 주소만 전달한다", async () => {
    const resolver = jest.fn().mockResolvedValue(["8.8.4.4"]);
    const request = successfulRequest();
    const service = new HttpWebhookService(resolver, request);

    await service.send("https://rebind.example/hook", event);

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]![0].resolvedAddress).toBe("8.8.4.4");
  });

  it("기본 설정에서 사설 네트워크 목적지를 거절한다", async () => {
    const request = successfulRequest();
    await expect(
      new HttpWebhookService(undefined, request).send(
        "https://127.0.0.1/hook",
        event,
      ),
    ).rejects.toThrow("FIREWALL_WEBHOOK_PRIVATE_NETWORK_NOT_ALLOWED");
    expect(request).not.toHaveBeenCalled();
  });

  it("IPv6 링크 로컬과 CGNAT 주소를 거절한다", async () => {
    const request = successfulRequest();
    const service = new HttpWebhookService(undefined, request);

    await expect(service.send("https://[fe90::1]/hook", event)).rejects.toThrow(
      "FIREWALL_WEBHOOK_PRIVATE_NETWORK_NOT_ALLOWED",
    );
    await expect(
      service.send("https://100.64.0.1/hook", event),
    ).rejects.toThrow("FIREWALL_WEBHOOK_PRIVATE_NETWORK_NOT_ALLOWED");
    expect(request).not.toHaveBeenCalled();
  });

  it("공개 hostname이 사설 주소를 반환하면 요청 전에 거절한다", async () => {
    const request = successfulRequest();
    await expect(
      new HttpWebhookService(async () => ["10.0.0.8"], request).send(
        "https://hooks.example.com/lynx",
        event,
      ),
    ).rejects.toMatchObject({
      retryable: false,
      message: "FIREWALL_WEBHOOK_PRIVATE_NETWORK_NOT_ALLOWED",
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("서버 오류는 재시도하고 일반 클라이언트 오류는 최종 실패로 분류한다", async () => {
    const request = jest
      .fn<WebhookRequestExecutor>()
      .mockResolvedValueOnce({ statusCode: 503, retryAfter: null })
      .mockResolvedValueOnce({ statusCode: 400, retryAfter: null });
    const service = new HttpWebhookService(async () => ["8.8.8.8"], request);

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

  it("운영 환경의 HTTP URL과 URL 내 자격 증명을 거절한다", async () => {
    env.NODE_ENV = "production";
    const request = successfulRequest();
    const service = new HttpWebhookService(async () => ["8.8.8.8"], request);

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
    expect(request).not.toHaveBeenCalled();
  });

  it("네트워크 오류를 재시도 가능한 실패로 변환한다", async () => {
    const request = jest
      .fn<WebhookRequestExecutor>()
      .mockRejectedValue(new Error("connection reset"));

    await expect(
      new HttpWebhookService(async () => ["8.8.8.8"], request).send(
        "https://hooks.example.com/lynx",
        event,
      ),
    ).rejects.toMatchObject({
      retryable: true,
      statusCode: null,
      message: expect.stringContaining("FIREWALL_WEBHOOK_NETWORK_ERROR"),
    });
  });

  it("429 Retry-After 값을 재시도 지연 시간으로 보존한다", async () => {
    const request = jest
      .fn<WebhookRequestExecutor>()
      .mockResolvedValue({ statusCode: 429, retryAfter: "12" });

    await expect(
      new HttpWebhookService(async () => ["8.8.8.8"], request).send(
        "https://hooks.example.com/lynx",
        event,
      ),
    ).rejects.toMatchObject({
      retryable: true,
      statusCode: 429,
      retryAfterMs: 12_000,
    });
  });

  it("명시적으로 허용한 개발 환경에서는 사설 주소에도 전송한다", async () => {
    env.FIREWALL_WEBHOOK_ALLOW_PRIVATE_NETWORK = true;
    const request = successfulRequest();

    await expect(
      new HttpWebhookService(undefined, request).send(
        "https://10.0.0.8/lynx",
        event,
      ),
    ).resolves.toEqual({ statusCode: 204 });
    expect(request.mock.calls[0]![0].resolvedAddress).toBe("10.0.0.8");
  });
});

describe("executePinnedRequest", () => {
  it("hostname을 다시 조회하지 않고 지정한 IP socket으로 연결한다", async () => {
    let receivedHost = "";
    let receivedBody = "";
    const server = createServer((request, response) => {
      receivedHost = request.headers.host ?? "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        receivedBody += chunk;
      });
      request.on("end", () => {
        response.writeHead(204);
        response.end();
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      throw new Error("TEST_SERVER_ADDRESS_UNAVAILABLE");
    }

    try {
      await expect(
        executePinnedRequest({
          destination: new URL(
            `http://does-not-resolve.invalid:${address.port}/hook?source=test`,
          ),
          resolvedAddress: "127.0.0.1",
          headers: { "Content-Type": "application/json" },
          body: '{"ok":true}',
          timeoutMs: 1_000,
        }),
      ).resolves.toEqual({ statusCode: 204, retryAfter: null });
      expect(receivedHost).toBe(`does-not-resolve.invalid:${address.port}`);
      expect(receivedBody).toBe('{"ok":true}');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
