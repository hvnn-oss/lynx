/** 방화벽 알림 provider가 전달하는 표준 Webhook 이벤트입니다. */
export interface FirewallWebhookEvent {
  id: string;
  type: "firewall.blocked" | "approval.requested" | "approval.decided";
  occurredAt: string;
  workspaceId: string;
  data: Record<string, unknown>;
}

/** 외부 또는 온프레미스 알림 구현으로 교체 가능한 Webhook 경계입니다. */
export interface WebhookService {
  /** 지정된 목적지로 서명 가능한 JSON 이벤트를 전송합니다. */
  send(url: string, event: FirewallWebhookEvent): Promise<void>;
}
