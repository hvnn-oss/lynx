import { createHmac } from "node:crypto";
import { env } from "../../common/config/config.js";
import type {
  FirewallWebhookEvent,
  WebhookService,
} from "./webhook.service.js";

const WEBHOOK_TIMEOUT_MS = 3_000;

/** 표준 HTTP POST로 방화벽 Webhook을 전달합니다. */
export class HttpWebhookService implements WebhookService {
  /** 타임스탬프와 본문을 HMAC 서명해 JSON 이벤트를 전송합니다. */
  async send(url: string, event: FirewallWebhookEvent): Promise<void> {
    const destination = new URL(url);
    if (
      destination.protocol !== "https:" &&
      !(env.NODE_ENV !== "production" && destination.protocol === "http:")
    ) {
      throw new Error("FIREWALL_WEBHOOK_URL_NOT_ALLOWED");
    }
    if (destination.username || destination.password) {
      throw new Error("FIREWALL_WEBHOOK_CREDENTIALS_NOT_ALLOWED");
    }
    if (
      !env.FIREWALL_WEBHOOK_ALLOW_PRIVATE_NETWORK &&
      this.isPrivateHostname(destination.hostname)
    ) {
      throw new Error("FIREWALL_WEBHOOK_PRIVATE_NETWORK_NOT_ALLOWED");
    }
    const body = JSON.stringify(event);
    const timestamp = String(Date.now());
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
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
    const response = await fetch(destination, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`FIREWALL_WEBHOOK_FAILED_${response.status}`);
    }
  }

  /** 명시적 온프레미스 설정 없이는 로컬·사설 네트워크 목적지를 차단합니다. */
  private isPrivateHostname(hostname: string): boolean {
    const value = hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (value === "localhost" || value.endsWith(".localhost")) return true;
    if (value === "::1" || value.startsWith("fc") || value.startsWith("fd")) {
      return true;
    }
    if (value.startsWith("fe80:")) return true;
    const octets = value.split(".").map(Number);
    if (
      octets.length !== 4 ||
      octets.some((octet) => !Number.isInteger(octet))
    ) {
      return false;
    }
    return (
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && (octets[1] ?? 0) >= 16 && (octets[1] ?? 0) <= 31) ||
      (octets[0] === 192 && octets[1] === 168)
    );
  }
}
