import {
  DEFAULT_USER_ENTITLEMENTS,
  ERROR_CODES,
  USER_PERMISSIONS,
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
  TransferOrganizationOwnerResponseDto,
  UpdateOrganizationMemberRoleDto,
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
import { env } from "../../common/config/config.js";
import {
  canAssignOrganizationRole,
  canManageOrganizationMember,
} from "../../common/access-control/organization-role.policy.js";
import { logger } from "../../common/logger/logger.js";

type ImageServiceFactory = () => ImageService;
type DefaultProfileImages = {
  user: string | null;
  organization: string | null;
};

/** 사용자 권한과 생성 횟수를 적용해 조직 생성을 조정합니다. */
export class OrganizationService {
  constructor(
    private readonly repository: OrganizationRepository = orgRepository,
    private readonly accessControl: AccessControlService = accessControlService,
    private readonly images: ImageServiceFactory = getImageService,
    private readonly defaultProfileImages: DefaultProfileImages = {
      user: env.DEFAULT_USER_PROFILE_IMAGE_URL ?? null,
      organization: env.DEFAULT_ORGANIZATION_PROFILE_IMAGE_URL ?? null,
    },
  ) {}

  /** 현재 사용자가 멤버로 참여 중인 조직 목록을 반환합니다. */
  async listOrganizations(userId: string) {
    return {
      items: (await this.repository.listForUser(userId)).map(
        ({ profileImageKey, ...organization }) => ({
          ...organization,
          profileImageUrl: this.resolveProfileImageUrl(
            profileImageKey,
            this.defaultProfileImages.organization,
          ),
        }),
      ),
    };
  }

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
          profileImageUrl: this.resolveProfileImageUrl(
            membership.user.profileImageKey,
            this.defaultProfileImages.user,
          ),
          role: membership.role,
          joinedAt: membership.joinedAt.toISOString(),
        }),
      ),
    };
  }

  /** Owner와 Admin이 자신보다 낮은 조직 멤버의 역할을 변경합니다. */
  async updateMemberRole(input: {
    userId: string;
    organizationId: string;
    memberId: number;
    update: UpdateOrganizationMemberRoleDto;
  }) {
    await this.accessControl.assertOrganizationCapability({
      userId: input.userId,
      organizationId: input.organizationId,
      capability: CAPABILITIES.ORGANIZATION_MEMBER_MANAGE,
    });

    await this.repository.transaction(async (manager) => {
      // 같은 조직의 역할 변경은 항상 행위자 다음 대상 순서로 잠가 교착을 피합니다.
      const actor = await this.repository.findLockedMemberByUserId(
        manager,
        input.organizationId,
        input.userId,
      );
      const target = await this.repository.findLockedMemberById(
        manager,
        input.organizationId,
        input.memberId,
      );
      if (!actor || !target) {
        throw new HTTPException(404, {
          message: ERROR_CODES.ORGANIZATION_MEMBER_NOT_FOUND,
        });
      }
      if (
        !canManageOrganizationMember(actor.role, target.role) ||
        !canAssignOrganizationRole(actor.role, input.update.role)
      ) {
        throw new HTTPException(403, {
          message: ERROR_CODES.ORGANIZATION_MEMBER_ROLE_FORBIDDEN,
        });
      }

      target.role = input.update.role;
      await this.repository.saveMembership(manager, target);
    });

    return this.listMembers(input);
  }

  /** 현재 Owner가 다른 조직 멤버에게 소유권을 원자적으로 위임합니다. */
  async transferOwner(input: {
    userId: string;
    organizationId: string;
    nextOwnerUserId: string;
  }): Promise<TransferOrganizationOwnerResponseDto> {
    await this.accessControl.assertOrganizationCapability({
      userId: input.userId,
      organizationId: input.organizationId,
      capability: CAPABILITIES.ORGANIZATION_OWNER_TRANSFER,
    });

    return this.repository.transaction(async (manager) => {
      const organization = await this.repository.findLockedOrganization(
        manager,
        input.organizationId,
      );
      const previousOwner = await this.repository.findLockedMemberByUserId(
        manager,
        input.organizationId,
        input.userId,
      );
      const nextOwner = await this.repository.findLockedMemberByUserId(
        manager,
        input.organizationId,
        input.nextOwnerUserId,
      );
      if (!organization || !previousOwner || !nextOwner) {
        throw new HTTPException(404, {
          message: ERROR_CODES.ORGANIZATION_MEMBER_NOT_FOUND,
        });
      }
      if (
        previousOwner.user.id === nextOwner.user.id ||
        previousOwner.role !== USER_PERMISSIONS.OWNER ||
        organization.ownerUserId !== previousOwner.user.id
      ) {
        throw new HTTPException(403, {
          message: ERROR_CODES.ORGANIZATION_OWNER_TRANSFER_FORBIDDEN,
        });
      }

      previousOwner.role = USER_PERMISSIONS.ADMIN;
      nextOwner.role = USER_PERMISSIONS.OWNER;
      organization.ownerUserId = nextOwner.user.id;
      await this.repository.saveOwnershipTransfer(
        manager,
        organization,
        previousOwner,
        nextOwner,
      );
      return {
        previousOwnerUserId: previousOwner.user.id,
        ownerUserId: nextOwner.user.id,
      };
    });
  }

  /** 조직 이름 확인 후 Owner 또는 Admin 요청으로 조직과 하위 데이터를 삭제합니다. */
  async deleteOrganization(input: {
    userId: string;
    organizationId: string;
    confirmationName: string;
  }): Promise<{ success: true }> {
    await this.accessControl.assertOrganizationCapability({
      userId: input.userId,
      organizationId: input.organizationId,
      capability: CAPABILITIES.ORGANIZATION_DELETE,
    });
    const current = await this.findProfile(input);
    if (current.organization.name !== input.confirmationName) {
      throw new HTTPException(400, {
        message: ERROR_CODES.ORGANIZATION_DELETE_CONFIRMATION_MISMATCH,
      });
    }

    const result = await this.repository.deleteOrganization(
      input.organizationId,
    );
    if (!result.deleted) {
      throw new NotFoundErrorException("ORGANIZATION_NOT_FOUND");
    }
    if (result.profileImageKey) {
      await Promise.resolve()
        .then(() =>
          this.images().delete(
            "organization",
            input.organizationId,
            result.profileImageKey,
          ),
        )
        .catch((error: unknown) => {
          logger.warn(
            { err: error, organizationId: input.organizationId },
            "deleted organization profile image cleanup failed",
          );
        });
    }
    return { success: true };
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
      profileImageUrl: this.resolveProfileImageUrl(
        profile.organization.profileImageKey,
        this.defaultProfileImages.organization,
      ),
      role: profile.role,
    };
  }

  /** 저장된 키를 공개 URL로 바꾸고, 키가 없으면 설정된 기본 URL을 사용합니다. */
  private resolveProfileImageUrl(
    storageKey: string | null,
    defaultUrl: string | null,
  ): string | null {
    return storageKey ? this.images().getUrl(storageKey) : defaultUrl;
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
