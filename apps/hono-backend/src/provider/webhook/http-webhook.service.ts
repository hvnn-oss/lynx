import { createHmac } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request as requestHttp } from "node:http";
import { request as requestHttps } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { env } from "../../common/config/config.js";
import type {
  FirewallWebhookEvent,
  WebhookDeliveryResult,
  WebhookService,
} from "./webhook.service.js";

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429]);

type HostResolver = (hostname: string) => Promise<string[]>;

export interface WebhookHttpRequest {
  destination: URL;
  resolvedAddress: string;
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
}

export interface WebhookHttpResponse {
  statusCode: number;
  retryAfter: string | null;
}

export type WebhookRequestExecutor = (
  request: WebhookHttpRequest,
) => Promise<WebhookHttpResponse>;

/** 재시도 여부와 HTTP 상태를 함께 전달하는 Webhook 전송 오류입니다. */
export class WebhookRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly statusCode: number | null = null,
    readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = "WebhookRequestError";
  }
}

/** DNS 검사 결과와 실제 연결 주소를 일치시켜 Webhook을 전달합니다. */
export class HttpWebhookService implements WebhookService {
  constructor(
    private readonly hostResolver: HostResolver = resolveWebhookHost,
    private readonly requestExecutor: WebhookRequestExecutor = executePinnedRequest,
  ) {}

  /** 타임스탬프와 본문을 HMAC으로 서명하고 안정적인 이벤트 ID와 함께 전송합니다. */
  async send(
    url: string,
    event: FirewallWebhookEvent,
  ): Promise<WebhookDeliveryResult> {
    const destination = new URL(url);
    const resolvedAddress = await this.resolveAllowedDestination(destination);
    const body = JSON.stringify(event);
    const timestamp = String(Date.now());
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Lynx-Webhook/1.0",
      "X-Lynx-Delivery": event.id,
      "X-Lynx-Event": event.type,
      "X-Lynx-Timestamp": timestamp,
    };
    if (env.FIREWALL_WEBHOOK_SIGNING_SECRET) {
      headers["X-Lynx-Signature"] = `sha256=${createHmac(
        "sha256",
        env.FIREWALL_WEBHOOK_SIGNING_SECRET,
      )
        .update(`${timestamp}.${body}`, "utf8")
        .digest("hex")}`;
    }

    let response: WebhookHttpResponse;
    try {
      response = await this.requestExecutor({
        destination,
        resolvedAddress,
        headers,
        body,
        timeoutMs: env.FIREWALL_WEBHOOK_TIMEOUT_MS,
      });
    } catch (error) {
      throw new WebhookRequestError(
        error instanceof Error
          ? `FIREWALL_WEBHOOK_NETWORK_ERROR:${error.message}`
          : "FIREWALL_WEBHOOK_NETWORK_ERROR",
        true,
      );
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      const isRetryable =
        RETRYABLE_STATUS_CODES.has(response.statusCode) ||
        response.statusCode >= 500;
      throw new WebhookRequestError(
        `FIREWALL_WEBHOOK_FAILED_${response.statusCode}`,
        isRetryable,
        response.statusCode,
        parseRetryAfter(response.retryAfter),
      );
    }
    return { statusCode: response.statusCode };
  }

  /** 프로토콜, 자격 증명, DNS 결과를 검사하고 실제 연결에 사용할 IP를 반환합니다. */
  private async resolveAllowedDestination(destination: URL): Promise<string> {
    if (
      destination.protocol !== "https:" &&
      !(env.NODE_ENV !== "production" && destination.protocol === "http:")
    ) {
      throw new WebhookRequestError("FIREWALL_WEBHOOK_URL_NOT_ALLOWED", false);
    }
    if (destination.username || destination.password) {
      throw new WebhookRequestError(
        "FIREWALL_WEBHOOK_CREDENTIALS_NOT_ALLOWED",
        false,
      );
    }

    const hostname = destination.hostname.replace(/^\[|\]$/g, "");
    const addresses = isIP(hostname)
      ? [hostname]
      : await this.hostResolver(hostname).catch((error) => {
          throw new WebhookRequestError(
            error instanceof Error
              ? `FIREWALL_WEBHOOK_DNS_ERROR:${error.message}`
              : "FIREWALL_WEBHOOK_DNS_ERROR",
            true,
          );
        });
    if (addresses.length === 0) {
      throw new WebhookRequestError("FIREWALL_WEBHOOK_DNS_EMPTY", true);
    }
    if (
      !env.FIREWALL_WEBHOOK_ALLOW_PRIVATE_NETWORK &&
      addresses.some(isNonPublicAddress)
    ) {
      throw new WebhookRequestError(
        "FIREWALL_WEBHOOK_PRIVATE_NETWORK_NOT_ALLOWED",
        false,
      );
    }
    return addresses[0]!;
  }
}

/**
 * 검증한 IP를 socket lookup 결과로 고정하면서 TLS 인증서는 원래 hostname으로 검증합니다.
 */
export function executePinnedRequest(
  input: WebhookHttpRequest,
): Promise<WebhookHttpResponse> {
  return new Promise((resolve, reject) => {
    const hostname = input.destination.hostname.replace(/^\[|\]$/g, "");
    const family = isIP(input.resolvedAddress);
    if (!family) {
      reject(new Error("FIREWALL_WEBHOOK_RESOLVED_ADDRESS_INVALID"));
      return;
    }

    const pinnedLookup = ((
      _hostname: string,
      options:
        | { all?: boolean }
        | ((
            error: NodeJS.ErrnoException | null,
            address: string,
            family: number,
          ) => void),
      callback?: (
        error: NodeJS.ErrnoException | null,
        address: string | Array<{ address: string; family: number }>,
        family?: number,
      ) => void,
    ) => {
      const done = typeof options === "function" ? options : callback;
      if (!done) {
        reject(new Error("FIREWALL_WEBHOOK_LOOKUP_CALLBACK_MISSING"));
        return;
      }
      if (typeof options !== "function" && options.all) {
        (
          done as unknown as (
            error: NodeJS.ErrnoException | null,
            addresses: Array<{ address: string; family: number }>,
          ) => void
        )(null, [{ address: input.resolvedAddress, family }]);
        return;
      }
      (
        done as (
          error: NodeJS.ErrnoException | null,
          address: string,
          family: number,
        ) => void
      )(null, input.resolvedAddress, family);
    }) as LookupFunction;
    const request =
      input.destination.protocol === "https:" ? requestHttps : requestHttp;
    const outbound = request(
      {
        protocol: input.destination.protocol,
        hostname,
        port: input.destination.port
          ? Number(input.destination.port)
          : undefined,
        path: `${input.destination.pathname}${input.destination.search}`,
        method: "POST",
        headers: input.headers,
        lookup: pinnedLookup,
        servername:
          input.destination.protocol === "https:" && !isIP(hostname)
            ? hostname
            : undefined,
      },
      (response) => {
        response.resume();
        response.once("end", () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            retryAfter: readHeader(response.headers["retry-after"]),
          });
        });
      },
    );
    outbound.setTimeout(input.timeoutMs, () => {
      outbound.destroy(new Error("FIREWALL_WEBHOOK_TIMEOUT"));
    });
    outbound.once("error", reject);
    outbound.end(input.body);
  });
}

/** Retry-After의 초 또는 HTTP 날짜 값을 지연 시간으로 정규화합니다. */
export function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1_000);
  }
  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) return null;
  return Math.max(0, retryAt - Date.now());
}

/** A와 AAAA 레코드를 모두 검사할 수 있도록 호스트의 전체 주소를 반환합니다. */
async function resolveWebhookHost(hostname: string): Promise<string[]> {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map((entry) => entry.address);
}

/** IPv4·IPv6의 로컬, 사설, 링크 로컬, 문서용 주소를 판별합니다. */
function isNonPublicAddress(address: string): boolean {
  const value = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (value === "::" || value === "::1") return true;
  if (value.startsWith("fc") || value.startsWith("fd")) return true;
  if (/^fe[89ab][0-9a-f]:/.test(value)) return true;
  if (value.startsWith("ff")) return true;
  if (value.startsWith("2001:db8:")) return true;
  if (value.startsWith("::ffff:")) {
    return isNonPublicAddress(value.slice("::ffff:".length));
  }

  const octets = value.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }
  const first = octets[0]!;
  const second = octets[1]!;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 &&
      (second === 0 || second === 2 || second === 88 || second === 168)) ||
    (first === 198 && (second === 18 || second === 19 || second === 51)) ||
    (first === 203 && second === 0 && octets[2] === 113)
  );
}

function readHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
