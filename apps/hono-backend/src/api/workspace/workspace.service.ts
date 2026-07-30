import type { CreateWorkspaceDto, WorkspaceResponseDto } from "@repo/dto";
import {
  WorkspaceRepository,
  workspaceRepository,
} from "./workspace.repository.js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { generateApiKey } from "../../common/util/api-key-parser.js";
import {
  AccessControlService,
  accessControlService,
} from "../../common/access-control/access-control.service.js";
import { CAPABILITIES } from "../../common/access-control/capabilities.js";
import { ERROR_CODES } from "@repo/constants";
import { BadRequestErrorException } from "../../common/exceptions/bad-request.js";
import type {
  CreatedWorkspaceApiKey,
  CreateWorkspaceApiKeyInput,
} from "../../common/types/workspace.js";
import {
  ApiKeyIssuancePolicy,
  apiKeyIssuancePolicy,
} from "../../common/access-control/api-key-issuance.policy.js";
import { openAPIEventService } from "../openapi/event.service.js";
import {
  ProductAccessService,
  productAccessService,
} from "../../common/access-control/product-access.service.js";

type CreateWorkspaceInput = CreateWorkspaceDto & { userId: string };

/** 조직 권한과 요금제 한도를 적용해 워크스페이스 생성을 조정합니다. */
export class WorkspaceService {
  constructor(
    private readonly repository: WorkspaceRepository = workspaceRepository,
    private readonly accessControl: AccessControlService = accessControlService,
    private readonly apiKeyPolicy: ApiKeyIssuancePolicy = apiKeyIssuancePolicy,
    private readonly productAccess: Pick<
      ProductAccessService,
      "assertUserAccess" | "grantWorkspace"
    > = productAccessService,
  ) {}

  /** Returns the bounded workspace selector data available to the user. */
  async listWorkspaces(userId: string) {
    return {
      items: await this.repository.listForUser(userId),
    };
  }

  /**
   * 요청 사용자의 조직 관리 권한을 확인하고 워크스페이스를 생성합니다.
   * @param input 사용자, 조직, 워크스페이스 이름을 포함한 생성 입력입니다.
   * @returns 생성된 워크스페이스입니다.
   */
  async createWorkspace(
    input: CreateWorkspaceInput,
  ): Promise<WorkspaceResponseDto> {
    await this.accessControl.assertOrganizationCapability({
      userId: input.userId,
      organizationId: input.orgId,
      capability: CAPABILITIES.WORKSPACE_CREATE,
    });

    await this.productAccess.assertUserAccess(input.userId);
    const workspace = await this.repository.transaction(async (manager) => {
      const created = await this.repository.createWorkspace(manager, input);
      await this.productAccess.grantWorkspace(
        manager,
        input.userId,
        created.id,
      );
      return created;
    });
    return {
      id: workspace.id,
      name: workspace.name,
      orgId: input.orgId,
    };
  }

  /** 권한과 scope를 검증하고 원문을 한 번만 반환할 API Key를 생성합니다. */
  async createApiKey(
    input: CreateWorkspaceApiKeyInput,
  ): Promise<CreatedWorkspaceApiKey> {
    const access = await this.accessControl.assertWorkspaceCapability({
      userId: input.userId,
      workspaceId: input.workspaceId,
      capability: CAPABILITIES.WORKSPACE_API_KEY_CREATE,
    });
    this.apiKeyPolicy.assertWorkspaceScopes(access, input.scopes);

    const keyId = randomUUID();
    const secret = randomBytes(32).toString("base64url");
    const apiKey = generateApiKey({
      environment: input.environment,
      id: keyId,
      secret,
    });
    const keyHash = createHash("sha256").update(apiKey).digest("hex");
    const expiresAt = this.resolveExpirationDate(input.expirePeriodDays);
    const saved = await this.repository.createApiKey({
      userId: input.userId,
      workspaceId: input.workspaceId,
      name: input.name,
      id: keyId,
      keyHash,
      prefix: this.createApiKeyPrefix(input.environment, keyId),
      expiresAt,
      kind: input.kind,
      scopes: input.scopes,
    });

    return {
      id: saved.id,
      key: apiKey,
      name: saved.name,
      workspaceId: input.workspaceId,
      scopes: saved.scopes,
      expiresAt: saved.expiresAt ?? null,
    };
  }

  async listApiKeys(input: { userId: string; workspaceId: string }) {
    await this.accessControl.assertWorkspaceCapability({
      ...input,
      capability: CAPABILITIES.WORKSPACE_API_KEY_LIST,
    });
    return {
      items: (await this.repository.listApiKeys(input.workspaceId)).map(
        (apiKey) => ({
          id: apiKey.id,
          name: apiKey.name,
          prefix: apiKey.prefix,
          kind: apiKey.kind,
          scopes: apiKey.scopes,
          createdAt: apiKey.createdAt.toISOString(),
          lastUsedAt: apiKey.lastUsedAt?.toISOString() ?? null,
          expiresAt: apiKey.expiresAt?.toISOString() ?? null,
          revokedAt: apiKey.revokedAt?.toISOString() ?? null,
        }),
      ),
    };
  }

  async revokeApiKey(input: {
    userId: string;
    workspaceId: string;
    apiKeyId: string;
  }) {
    await this.accessControl.assertWorkspaceCapability({
      userId: input.userId,
      workspaceId: input.workspaceId,
      capability: CAPABILITIES.WORKSPACE_API_KEY_REVOKE,
    });
    await this.repository.revokeApiKey(input.workspaceId, input.apiKeyId);
    return { success: true as const };
  }

  async deleteApiKey(input: {
    userId: string;
    workspaceId: string;
    apiKeyId: string;
  }) {
    await this.accessControl.assertWorkspaceCapability({
      userId: input.userId,
      workspaceId: input.workspaceId,
      capability: CAPABILITIES.WORKSPACE_API_KEY_REVOKE,
    });
    const wasDeleted = await this.repository.deleteRevokedApiKey(
      input.workspaceId,
      input.apiKeyId,
    );
    if (!wasDeleted) {
      throw new BadRequestErrorException(ERROR_CODES.INVALID_INPUT);
    }
    return { success: true as const };
  }

  /** 접근 가능한 워크스페이스의 최근 Run 요약을 조회합니다. */
  async listRuns(input: {
    userId: string;
    workspaceId: string;
    cursor?: string;
    limit: number;
    agentId?: string;
    status?: string;
  }) {
    await this.accessControl.assertWorkspaceCapability({
      userId: input.userId,
      workspaceId: input.workspaceId,
      capability: CAPABILITIES.WORKSPACE_READ,
    });
    return openAPIEventService.listRuns(input.workspaceId, input);
  }

  /** 접근 가능한 워크스페이스의 Run과 Event 타임라인을 조회합니다. */
  async getRun(input: { userId: string; workspaceId: string; runId: string }) {
    await this.accessControl.assertWorkspaceCapability({
      userId: input.userId,
      workspaceId: input.workspaceId,
      capability: CAPABILITIES.WORKSPACE_READ,
    });
    return openAPIEventService.getRun(input.workspaceId, input.runId);
  }

  /** 현재 시각을 기준으로 API Key 만료 시각을 계산합니다. */
  private resolveExpirationDate(expirePeriodDays: number | null): Date | null {
    if (expirePeriodDays === null) return null;
    if (
      !Number.isInteger(expirePeriodDays) ||
      expirePeriodDays < 1 ||
      expirePeriodDays > 365
    ) {
      throw new BadRequestErrorException(ERROR_CODES.INVALID_INPUT);
    }
    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + expirePeriodDays);
    return expiresAt;
  }

  /** 목록에서 식별할 수 있고 DB 길이 제한을 넘지 않는 prefix를 만듭니다. */
  private createApiKeyPrefix(environment: string, keyId: string): string {
    const environmentPrefix = {
      development: "dev",
      staging: "stg",
      production: "prod",
    }[environment];
    if (!environmentPrefix) {
      throw new BadRequestErrorException(ERROR_CODES.INVALID_INPUT);
    }
    return `lynx_${environmentPrefix}_${keyId.slice(0, 8)}`;
  }
}

/** 애플리케이션에서 공유하는 워크스페이스 서비스입니다. */
export const workspaceService = new WorkspaceService();
