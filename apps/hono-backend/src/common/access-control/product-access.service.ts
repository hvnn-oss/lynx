import {
  ERROR_CODES,
  PRODUCT_ACCESS_CAPABILITY,
  PRODUCT_ACCESS_GRANT_STATUS,
  PRODUCT_ACCESS_MODE,
  PRODUCT_ACCESS_STATUS,
  PRODUCT_ACCESS_SUBJECT_TYPE,
  type ProductAccessStatus,
  type ProductAccessSubjectType,
} from "@repo/constants";
import { ProductAccessGrantEntity } from "@repo/database";
import type { ProductAccessContextDto } from "@repo/dto";
import type { EntityManager } from "typeorm";
import { env } from "../config/config.js";
import { ForbiddenErrorException } from "../exceptions/forbidden.js";
import { AppDataSource } from "../../provider/database/typeorm-config.js";

/**
 * 로그인 여부와 분리된 제품 사용 자격을 한 곳에서 판단합니다.
 *
 * 공개 출시 시에는 환경 설정만 PUBLIC으로 변경하며 기존 초대와 승인 기록은
 * 베타 기능이나 유료 권한에 다시 사용할 수 있도록 유지합니다.
 */
export class ProductAccessService {
  /** 현재 회원가입 정책을 공개 응답 형태로 반환합니다. */
  getSignupPolicy() {
    return {
      mode: env.SIGNUP_MODE,
      requiresInvitation: env.SIGNUP_MODE === PRODUCT_ACCESS_MODE.INVITE_ONLY,
    };
  }

  /** 인증된 사용자의 Lynx Core 접근 상태를 조회합니다. */
  async getUserContext(userId: string): Promise<ProductAccessContextDto> {
    if (env.PRODUCT_ACCESS_MODE === PRODUCT_ACCESS_MODE.PUBLIC) {
      return this.createContext(PRODUCT_ACCESS_STATUS.ACTIVE);
    }

    const grant = await AppDataSource.getRepository(
      ProductAccessGrantEntity,
    ).findOneBy({
      subjectType: PRODUCT_ACCESS_SUBJECT_TYPE.USER,
      subjectId: userId,
      capability: PRODUCT_ACCESS_CAPABILITY.LYNX_CORE,
    });
    return this.createContext(this.resolveGrantStatus(grant));
  }

  /** 승인되지 않은 사용자의 관리 API 요청을 일관된 403 오류로 차단합니다. */
  async assertUserAccess(userId: string): Promise<void> {
    const access = await this.getUserContext(userId);
    if (!access.canUseProduct) {
      throw new ForbiddenErrorException(ERROR_CODES.PRODUCT_ACCESS_NOT_GRANTED);
    }
  }

  /** 정지된 Workspace의 기존 SDK API Key가 계속 사용되지 않도록 확인합니다. */
  async assertWorkspaceAccess(workspaceId: string): Promise<void> {
    if (env.PRODUCT_ACCESS_MODE === PRODUCT_ACCESS_MODE.PUBLIC) return;

    const grant = await AppDataSource.getRepository(
      ProductAccessGrantEntity,
    ).findOneBy({
      subjectType: PRODUCT_ACCESS_SUBJECT_TYPE.WORKSPACE,
      subjectId: workspaceId,
      capability: PRODUCT_ACCESS_CAPABILITY.LYNX_CORE,
    });
    if (this.resolveGrantStatus(grant) !== PRODUCT_ACCESS_STATUS.ACTIVE) {
      throw new ForbiddenErrorException(ERROR_CODES.PRODUCT_ACCESS_NOT_GRANTED);
    }
  }

  /** 초대 수락과 같은 트랜잭션 안에서 사용자 접근 권한을 활성화합니다. */
  grantUser(
    manager: EntityManager,
    userId: string,
    grantedByUserId: string | null,
  ): Promise<void> {
    return this.grantSubject(
      manager,
      PRODUCT_ACCESS_SUBJECT_TYPE.USER,
      userId,
      grantedByUserId,
    );
  }

  /** 파일럿 사용자가 새로 만든 Workspace에 SDK 사용 권한을 승계합니다. */
  async grantWorkspaceForUser(
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    if (env.PRODUCT_ACCESS_MODE === PRODUCT_ACCESS_MODE.PUBLIC) return;

    await this.assertUserAccess(userId);
    await AppDataSource.transaction((manager) =>
      this.grantWorkspace(manager, userId, workspaceId),
    );
  }

  /**
   * 현재 트랜잭션 안에서 Workspace 제품 접근 권한을 함께 저장합니다.
   * @param manager Workspace 생성에 사용 중인 트랜잭션 매니저입니다.
   * @param userId Workspace를 생성한 사용자 식별자입니다.
   * @param workspaceId 접근 권한을 부여할 Workspace 식별자입니다.
   */
  grantWorkspace(
    manager: EntityManager,
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    if (env.PRODUCT_ACCESS_MODE === PRODUCT_ACCESS_MODE.PUBLIC) {
      return Promise.resolve();
    }

    return this.grantSubject(
      manager,
      PRODUCT_ACCESS_SUBJECT_TYPE.WORKSPACE,
      workspaceId,
      userId,
    );
  }

  /** 동일 subject에는 하나의 Core 권한만 존재하도록 upsert합니다. */
  private async grantSubject(
    manager: EntityManager,
    subjectType: ProductAccessSubjectType,
    subjectId: string,
    grantedByUserId: string | null,
  ): Promise<void> {
    const now = new Date();
    await manager.getRepository(ProductAccessGrantEntity).upsert(
      {
        subjectType,
        subjectId,
        capability: PRODUCT_ACCESS_CAPABILITY.LYNX_CORE,
        status: PRODUCT_ACCESS_GRANT_STATUS.ACTIVE,
        grantedByUserId,
        grantedAt: now,
        expiresAt: null,
        metadata: null,
      },
      ["subjectType", "subjectId", "capability"],
    );
  }

  /** 저장 상태와 만료 시각을 합쳐 화면에서 사용할 접근 상태로 변환합니다. */
  private resolveGrantStatus(
    grant: ProductAccessGrantEntity | null,
  ): ProductAccessStatus {
    if (!grant) return PRODUCT_ACCESS_STATUS.PENDING;
    if (grant.status === PRODUCT_ACCESS_GRANT_STATUS.SUSPENDED) {
      return PRODUCT_ACCESS_STATUS.SUSPENDED;
    }
    if (
      grant.status === PRODUCT_ACCESS_GRANT_STATUS.EXPIRED ||
      (grant.expiresAt !== null && grant.expiresAt.getTime() <= Date.now())
    ) {
      return PRODUCT_ACCESS_STATUS.EXPIRED;
    }
    return PRODUCT_ACCESS_STATUS.ACTIVE;
  }

  /** 접근 상태에서 bootstrap이 공통으로 사용하는 동작 가능 여부를 만듭니다. */
  private createContext(status: ProductAccessStatus): ProductAccessContextDto {
    const canUseProduct = status === PRODUCT_ACCESS_STATUS.ACTIVE;
    return {
      mode: env.PRODUCT_ACCESS_MODE,
      status,
      canUseProduct,
      canCreateWorkspace: canUseProduct,
      reason: canUseProduct ? null : ERROR_CODES.PRODUCT_ACCESS_NOT_GRANTED,
    };
  }
}

/** 애플리케이션 전체에서 제품 접근 정책을 동일하게 적용하는 서비스입니다. */
export const productAccessService = new ProductAccessService();
