import { HttpWebhookService } from "./http-webhook.service.js";
import type { WebhookService } from "./webhook.service.js";

let instance: WebhookService | undefined;

/** 현재 환경에 설정된 Webhook provider를 반환합니다. */
export function getWebhookService(): WebhookService {
  instance ??= new HttpWebhookService();
  return instance;
}
