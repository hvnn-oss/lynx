import { ERROR_CODES } from "@repo/constants";
import { ForbiddenErrorException } from "../exceptions/forbidden.js";
import {
  AccessControlRepository,
  accessControlRepository,
} from "./access-control.repository.js";
import type { WorkspaceAccess } from "../types/access-control.js";
import type { Capability } from "./capabilities.js";
import {
  ORGANIZATION_ROLE_CAPABILITIES,
  WORKSPACE_ROLE_CAPABILITIES,
} from "./role-capabilities.js";

/** 역할을 실제 행동 권한으로 변환하고 접근을 단언합니다. */
export class AccessControlService {
  constructor(
    private readonly repository: AccessControlRepository = accessControlRepository,
  ) {}

  /** 사용자에게 요청한 조직 행동 권한이 있는지 확인합니다. */
  async assertOrganizationCapability(input: {
    userId: string;
    organizationId: string;
    capability: Capability;
  }): Promise<void> {
    const role = await this.repository.findOrganizationRole(
      input.userId,
      input.organizationId,
    );
    if (!role || !ORGANIZATION_ROLE_CAPABILITIES[role].has(input.capability)) {
      this.throwForbidden();
    }
  }

  /** 조직 역할 상속과 워크스페이스 역할을 합쳐 행동 권한을 확인합니다. */
  async assertWorkspaceCapability(input: {
    userId: string;
    workspaceId: string;
    capability: Capability;
  }): Promise<WorkspaceAccess> {
    const access = await this.repository.findWorkspaceAccess(
      input.userId,
      input.workspaceId,
    );
    if (!access) this.throwForbidden();

    const hasOrganizationCapability = ORGANIZATION_ROLE_CAPABILITIES[
      access.organizationRole
    ].has(input.capability);
    const hasWorkspaceCapability = access.workspaceRole
      ? WORKSPACE_ROLE_CAPABILITIES[access.workspaceRole].has(input.capability)
      : false;
    if (!hasOrganizationCapability && !hasWorkspaceCapability) {
      this.throwForbidden();
    }
    return access;
  }

  private throwForbidden(): never {
    throw new ForbiddenErrorException(ERROR_CODES.FORBIDDEN);
  }
}

/** 애플리케이션에서 공유하는 접근 권한 서비스입니다. */
export const accessControlService = new AccessControlService();
