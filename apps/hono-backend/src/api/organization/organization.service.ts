import {
  DEFAULT_USER_ENTITLEMENTS,
  ERROR_CODES,
  type OrganizationCreationSource,
} from "@repo/constants";
import type { EntityManager } from "typeorm";
import { HTTPException } from "hono/http-exception";
import { NotFoundErrorException } from "../../common/exceptions/not-found.js";
import {
  OrganizationRepository,
  orgRepository,
} from "./organization.repository.js";
import type { OrganizationResponseDto } from "@repo/dto";
import type { CreateOrganizationInput } from "../../common/types/org.js";
import { getUtcDayStartedAt } from "../../common/util/get-utc-started-at.js";

/** 사용자 권한과 생성 횟수를 적용해 조직 생성을 조정합니다. */
export class OrganizationService {
  constructor(
    private readonly repository: OrganizationRepository = orgRepository,
  ) {}

  /**
   * 소유 조직 및 일일 생성 한도를 확인한 뒤 조직과 OWNER 멤버십을 생성합니다.
   * @param input 사용자와 멱등성 정보를 포함한 조직 생성 입력입니다.
   * @param entityManager 상위 회원가입 트랜잭션에서 전달할 선택 매니저입니다.
   * @returns 생성되거나 동일 요청에서 기존에 생성된 조직입니다.
   */
  async createOrganization(
    input: CreateOrganizationInput,
    entityManager?: EntityManager,
  ): Promise<OrganizationResponseDto> {
    const create = async (manager: EntityManager) => {
      const entitlement = await this.repository.getLockedEntitlement(
        manager,
        input.userId,
      );
      if (!entitlement) {
        throw new NotFoundErrorException("USER_ENTITLEMENT_NOT_FOUND");
      }

      // 사용자 권한 행 잠금 뒤 다시 확인해 같은 멱등성 키의 동시 요청도 하나만 생성합니다.
      const existing = await this.repository.findByRequestId(
        manager,
        input.requestId,
      );
      if (existing) return this.toResponse(existing);

      const isExpired =
        entitlement.expiresAt !== null &&
        entitlement.expiresAt !== undefined &&
        entitlement.expiresAt.getTime() <= Date.now();
      const maxOwnedOrganizations = isExpired
        ? DEFAULT_USER_ENTITLEMENTS.FREE.maxOwnedOrganizations
        : entitlement.maxOwnedOrganizations;
      const dailyCreateLimit = isExpired
        ? DEFAULT_USER_ENTITLEMENTS.FREE.dailyOrganizationCreateLimit
        : entitlement.dailyOrganizationCreateLimit;

      const ownedCount = await this.repository.countOwnedOrganizations(
        manager,
        input.userId,
      );
      if (
        maxOwnedOrganizations !== null &&
        ownedCount >= maxOwnedOrganizations
      ) {
        throw new HTTPException(403, {
          message: ERROR_CODES.OWNED_ORGANIZATION_LIMIT_REACHED,
        });
      }

      const dailyCreateCount = await this.repository.countDailyCreations(
        manager,
        input.userId,
        getUtcDayStartedAt(),
      );
      if (dailyCreateCount >= dailyCreateLimit) {
        throw new HTTPException(429, {
          message: ERROR_CODES.DAILY_ORGANIZATION_CREATE_LIMIT_REACHED,
        });
      }

      const organization = await this.repository.createRecords(manager, {
        ...input,
        dayStartedAt: getUtcDayStartedAt(),
      });
      return this.toResponse(organization);
    };

    return entityManager
      ? create(entityManager)
      : this.repository.transaction(create);
  }

  /** 조직 엔티티를 외부 응답 계약으로 변환합니다. */
  private toResponse(organization: {
    id: string;
    name: string;
  }): OrganizationResponseDto {
    return { id: organization.id, name: organization.name, role: "OWNER" };
  }
}

/** 애플리케이션에서 공유하는 조직 서비스입니다. */
export const orgService = new OrganizationService();
