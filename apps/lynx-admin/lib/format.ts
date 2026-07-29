const actionLabels: Record<string, string> = {
  "organization_plan.create": "요금제 생성",
  "organization_plan.update": "요금제 수정",
  "organization.plan_change": "조직 요금제 변경",
  "prompt.create": "프롬프트 생성",
  "prompt.update": "프롬프트 수정",
  "prompt.delete": "프롬프트 삭제",
  "prompt.deploy": "프롬프트 배포",
  "prompt.rollback": "프롬프트 롤백",
  "firewall_policy.create": "방화벽 정책 생성",
  "firewall_policy.update": "방화벽 정책 수정",
  "firewall_policy.delete": "방화벽 정책 삭제",
  "firewall_policy.deploy": "방화벽 정책 배포",
  "workspace_api_key.create": "API 키 생성",
  "workspace_api_key.delete": "API 키 삭제",
  "invitation.create": "초대 생성",
  "invitation.delete": "초대 취소",
};

export function formatAction(action: string): string {
  return actionLabels[action] ?? action.replaceAll("_", " ");
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(value);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 6 : 2,
  }).format(value);
}

export function formatLimit(value: number | null): string {
  return value === null ? "무제한" : formatNumber(value);
}
