import type { CreateFirewallApprovalDto } from "@repo/dto";
import { NotFoundErrorException } from "../../../common/exceptions/not-found.js";
import {
  OpenAPIApprovalRepository,
  openAPIApprovalRepository,
} from "./approval.repository.js";
import { firewallNotificationService } from "../../../common/services/firewall-notification.service.js";

/** Creates SDK approval requests and returns their current status. */
export class OpenAPIApprovalService {
  constructor(
    private readonly repository: OpenAPIApprovalRepository = openAPIApprovalRepository,
  ) {}

  /** Creates an approval request before a protected tool call executes. */
  async create(
    workspaceId: string,
    sdkInstanceId: string,
    body: CreateFirewallApprovalDto,
  ) {
    const created = await this.repository.create(
      workspaceId,
      sdkInstanceId,
      body,
    );
    const request = created.request;
    if (created.isNew) {
      firewallNotificationService.notify({
        workspaceId,
        policyId: request.reportedPolicyId,
        type: "approval.requested",
        data: {
          approvalId: request.id,
          toolName: request.toolName,
          runId: request.runId,
          sessionId: request.sessionId,
          agentId: request.agentId,
          expiresAt: request.expiresAt.toISOString(),
        },
      });
    }
    return this.toResponse(request);
  }

  /** Reads approval status and expires a pending request after its deadline. */
  async get(workspaceId: string, sdkInstanceId: string, approvalId: string) {
    let request = await this.repository.find(
      workspaceId,
      sdkInstanceId,
      approvalId,
    );
    if (!request) throw new NotFoundErrorException("APPROVAL_NOT_FOUND");
    if (request.status === "PENDING" && request.expiresAt <= new Date()) {
      request = await this.repository.expire(request);
    }
    return this.toResponse(request);
  }

  /** Maps the stored approval request to the public SDK response. */
  private toResponse(
    request: Awaited<
      ReturnType<OpenAPIApprovalRepository["create"]>
    >["request"],
  ) {
    return {
      id: request.id,
      status: request.status,
      expiresAt: request.expiresAt.toISOString(),
      decidedAt: request.decidedAt?.toISOString() ?? null,
      decisionReason: request.decisionReason,
    };
  }
}

export const openAPIApprovalService = new OpenAPIApprovalService();
