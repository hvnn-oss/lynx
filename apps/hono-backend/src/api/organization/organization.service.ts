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
import type {
  OrganizationProfileResponseDto,
  ProfileImageResponseDto,
  UpdateOrganizationProfileDto,
} from "@repo/dto";
import type { CreateOrganizationInput } from "../../common/types/org.js";
import { getUtcDayStartedAt } from "../../common/util/get-utc-started-at.js";
import {
  accessControlService,
  AccessControlService,
} from "../../common/access-control/access-control.service.js";
import { CAPABILITIES } from "../../common/access-control/capabilities.js";
import type { ImageUploadBody } from "../../common/util/read-image-upload.js";
import { getImageService } from "../../provider/image/image-provider.js";
import type { ImageService } from "../../provider/image/image.service.js";
import { BadRequestErrorException } from "../../common/exceptions/bad-request.js";

type ImageServiceFactory = () => ImageService;

/** 사용자 권한과 생성 횟수를 적용해 조직 생성을 조정합니다. */
export class OrganizationService {
  constructor(
    private readonly repository: OrganizationRepository = orgRepository,
    private readonly accessControl: AccessControlService = accessControlService,
    private readonly images: ImageServiceFactory = getImageService,
  ) {}

  /** 조직 멤버에게 조직 프로필과 자신의 조직 역할을 반환합니다. */
  async getProfile(input: {
    userId: string;
    organizationId: string;
  }): Promise<OrganizationProfileResponseDto> {
    await this.accessControl.assertOrganizationCapability({
      ...input,
      capability: CAPABILITIES.ORGANIZATION_READ,
    });
    const profile = await this.findProfile(input);
    return this.toProfileResponse(profile);
  }

  async listMembers(input: { userId: string; organizationId: string }) {
    await this.accessControl.assertOrganizationCapability({
      ...input,
      capability: CAPABILITIES.ORGANIZATION_READ,
    });
    return {
      items: (await this.repository.listMembers(input.organizationId)).map(
        (membership) => ({
          id: membership.id,
          userId: membership.user.id,
          name: membership.user.name,
          email: membership.user.email,
          role: membership.role,
          joinedAt: membership.joinedAt.toISOString(),
        }),
      ),
    };
  }

  /** OWNER와 ADMIN이 조직 이름을 변경할 수 있게 합니다. */
  async updateProfile(input: {
    userId: string;
    organizationId: string;
    profile: UpdateOrganizationProfileDto;
  }): Promise<OrganizationProfileResponseDto> {
    await this.accessControl.assertOrganizationCapability({
      userId: input.userId,
      organizationId: input.organizationId,
      capability: CAPABILITIES.ORGANIZATION_UPDATE,
    });
    const current = await this.findProfile(input);
    await this.repository.updateProfileName(
      input.organizationId,
      input.profile.name,
    );
    current.organization.name = input.profile.name;
    return this.toProfileResponse(current);
  }

  /** OWNER와 ADMIN이 조직 프로필 이미지를 추가하거나 덮어쓰게 합니다. */
  async uploadProfileImage(input: {
    userId: string;
    organizationId: string;
    upload: ImageUploadBody;
  }): Promise<ProfileImageResponseDto> {
    await this.accessControl.assertOrganizationCapability({
      userId: input.userId,
      organizationId: input.organizationId,
      capability: CAPABILITIES.ORGANIZATION_UPDATE,
    });
    const current = await this.findProfile(input);

    try {
      const image = current.organization.profileImageKey
        ? await this.images().update({
            ownerType: "organization",
            ownerId: input.organizationId,
            currentStorageKey: current.organization.profileImageKey,
            ...input.upload,
          })
        : await this.images().upload({
            ownerType: "organization",
            ownerId: input.organizationId,
            ...input.upload,
          });
      await this.repository.updateProfileImageKey(
        input.organizationId,
        image.storageKey,
      );
      return { profileImageUrl: image.url };
    } catch (error) {
      this.rethrowImageInputError(error);
    }
  }

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

  /** 조직 엔티티와 멤버 역할을 외부 프로필 계약으로 변환합니다. */
  private toProfileResponse(
    profile: NonNullable<
      Awaited<ReturnType<OrganizationRepository["findProfile"]>>
    >,
  ): OrganizationProfileResponseDto {
    return {
      id: profile.organization.id,
      name: profile.organization.name,
      profileImageUrl: profile.organization.profileImageKey
        ? this.images().getUrl(profile.organization.profileImageKey)
        : null,
      role: profile.role,
    };
  }

  /** 접근 권한 확인 이후에도 사라진 조직은 404로 처리합니다. */
  private async findProfile(input: { userId: string; organizationId: string }) {
    const profile = await this.repository.findProfile(
      input.organizationId,
      input.userId,
    );
    if (!profile) throw new NotFoundErrorException("ORGANIZATION_NOT_FOUND");
    return profile;
  }

  /** 사용자가 수정할 수 있는 이미지 입력 오류만 HTTP 400으로 변환합니다. */
  private rethrowImageInputError(error: unknown): never {
    const message = error instanceof Error ? error.message : "";
    if (
      [
        "PROFILE_IMAGE_EMPTY",
        "PROFILE_IMAGE_TOO_LARGE",
        "PROFILE_IMAGE_TYPE_NOT_SUPPORTED",
      ].includes(message)
    ) {
      throw new BadRequestErrorException(message);
    }
    throw error;
  }
}

/** 애플리케이션에서 공유하는 조직 서비스입니다. */
export const orgService = new OrganizationService();
