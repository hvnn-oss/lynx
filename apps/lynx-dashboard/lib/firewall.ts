import {
  firewallApprovalContract,
  firewallPolicyContract,
} from "@repo/contract";
import type {
  CreateFirewallPolicyDto,
  DecideFirewallApprovalDto,
  FirewallRecordListQueryDto,
  SimulateFirewallPolicyDto,
  UpdateFirewallPolicyDto,
  WebhookDeliveryListQueryDto,
} from "@repo/dto";
import { requestContract } from "./api";

/** 워크스페이스의 방화벽 정책과 목록용 운영 상태를 조회합니다. */
export function listFirewallPolicies(workspaceId: string) {
  return requestContract({
    basePath: firewallPolicyContract.basePath,
    endpoint: firewallPolicyContract.list,
    params: { workspaceId },
  });
}

/** 편집할 정책의 현재 초안을 조회합니다. */
export function getFirewallPolicy(workspaceId: string, policyId: number) {
  return requestContract({
    basePath: firewallPolicyContract.basePath,
    endpoint: firewallPolicyContract.detail,
    params: { workspaceId, policyId },
  });
}

/** 정책의 불변 배포 리비전 이력을 조회합니다. */
export function listFirewallPolicyRevisions(
  workspaceId: string,
  policyId: number,
) {
  return requestContract({
    basePath: firewallPolicyContract.basePath,
    endpoint: firewallPolicyContract.revisions,
    params: { workspaceId, policyId },
  });
}

/** 정책 적용 범위에서 선택할 수 있는 Agent 목록을 조회합니다. */
export function listFirewallPolicyTargetOptions(workspaceId: string) {
  return requestContract({
    basePath: firewallPolicyContract.basePath,
    endpoint: firewallPolicyContract.targetOptions,
    params: { workspaceId },
  });
}

/** 새 정책 초안을 생성합니다. */
export function createFirewallPolicy(
  workspaceId: string,
  input: CreateFirewallPolicyDto,
) {
  return requestContract({
    basePath: firewallPolicyContract.basePath,
    endpoint: firewallPolicyContract.create,
    params: { workspaceId },
    request: input,
  });
}

/** 기대 리비전을 기준으로 정책 초안을 저장합니다. */
export function updateFirewallPolicy(
  workspaceId: string,
  policyId: number,
  input: UpdateFirewallPolicyDto,
) {
  return requestContract({
    basePath: firewallPolicyContract.basePath,
    endpoint: firewallPolicyContract.update,
    params: { workspaceId, policyId },
    request: input,
  });
}

/** 현재 정책 초안을 SDK 배포본으로 게시합니다. */
export function deployFirewallPolicy(workspaceId: string, policyId: number) {
  return requestContract({
    basePath: firewallPolicyContract.basePath,
    endpoint: firewallPolicyContract.deploy,
    params: { workspaceId, policyId },
  });
}

/** 배포된 정책을 활성화합니다. */
export function activateFirewallPolicy(workspaceId: string, policyId: number) {
  return requestContract({
    basePath: firewallPolicyContract.basePath,
    endpoint: firewallPolicyContract.activate,
    params: { workspaceId, policyId },
  });
}

/** 정책을 삭제하지 않고 SDK 평가 대상에서 제외합니다. */
export function deactivateFirewallPolicy(
  workspaceId: string,
  policyId: number,
) {
  return requestContract({
    basePath: firewallPolicyContract.basePath,
    endpoint: firewallPolicyContract.deactivate,
    params: { workspaceId, policyId },
  });
}

/** 과거 배포 리비전으로 롤백합니다. */
export function rollbackFirewallPolicy(
  workspaceId: string,
  policyId: number,
  revision: number,
) {
  return requestContract({
    basePath: firewallPolicyContract.basePath,
    endpoint: firewallPolicyContract.rollback,
    params: { workspaceId, policyId, revision },
  });
}

/** 정책과 참조 이력을 보존하면서 소프트 삭제합니다. */
export function deleteFirewallPolicy(workspaceId: string, policyId: number) {
  return requestContract({
    basePath: firewallPolicyContract.basePath,
    endpoint: firewallPolicyContract.delete,
    params: { workspaceId, policyId },
  });
}

/** 승인 요청 목록을 상태별로 조회합니다. */
export function listFirewallApprovals(
  workspaceId: string,
  status?: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED",
) {
  return requestContract({
    basePath: firewallApprovalContract.basePath,
    endpoint: firewallApprovalContract.list,
    params: { workspaceId },
    request: { status, limit: 100 },
  });
}

/** 대기 중인 도구 실행을 승인하거나 거절합니다. */
export function decideFirewallApproval(
  workspaceId: string,
  approvalId: string,
  input: DecideFirewallApprovalDto,
) {
  return requestContract({
    basePath: firewallApprovalContract.basePath,
    endpoint: firewallApprovalContract.decide,
    params: { workspaceId, approvalId },
    request: input,
  });
}

/** 정책 판단과 탐지·차단 기록을 조회합니다. */
export function listFirewallRecords(
  workspaceId: string,
  query: FirewallRecordListQueryDto = { limit: 25 },
) {
  return requestContract({
    basePath: firewallPolicyContract.basePath,
    endpoint: firewallPolicyContract.records,
    params: { workspaceId },
    request: query,
  });
}

/** 실제 실행 없이 현재 정책 초안의 판단 근거를 확인합니다. */
export function simulateFirewallPolicy(
  workspaceId: string,
  policyId: number,
  input: SimulateFirewallPolicyDto,
) {
  return requestContract({
    basePath: firewallPolicyContract.basePath,
    endpoint: firewallPolicyContract.simulate,
    params: { workspaceId, policyId },
    request: input,
  });
}

/** 정책별 Webhook 전송 성공·재시도·실패 이력을 조회합니다. */
export function listFirewallWebhookDeliveries(
  workspaceId: string,
  policyId: number,
  query: WebhookDeliveryListQueryDto = { limit: 10 },
) {
  return requestContract({
    basePath: firewallPolicyContract.basePath,
    endpoint: firewallPolicyContract.webhookDeliveries,
    params: { workspaceId, policyId },
    request: query,
  });
}

/** 현재 저장된 정책 Webhook URL로 테스트 이벤트를 예약합니다. */
export function testFirewallPolicyWebhook(
  workspaceId: string,
  policyId: number,
) {
  return requestContract({
    basePath: firewallPolicyContract.basePath,
    endpoint: firewallPolicyContract.testWebhook,
    params: { workspaceId, policyId },
  });
}

/** 실패하거나 예약된 Webhook 전송을 즉시 다시 시도합니다. */
export function retryFirewallWebhookDelivery(
  workspaceId: string,
  policyId: number,
  deliveryId: string,
) {
  return requestContract({
    basePath: firewallPolicyContract.basePath,
    endpoint: firewallPolicyContract.retryWebhookDelivery,
    params: { workspaceId, policyId, deliveryId },
  });
}
