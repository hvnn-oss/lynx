import {
  ACCESS_INVITATION_STATUS,
  ACCESS_INVITATION_TARGET_TYPE,
  ADMIN_ROLES,
  ERROR_CODES,
  PRODUCT_ACCESS_MODE,
  USER_PERMISSIONS,
  type AccessInvitationStatus,
} from "@repo/constants";
import {
  AdminUserEntity,
  type AccessInvitationEntity,
} from "@repo/database";
import type {
  AccessInvitationResponseDto,
  AcceptTeamInvitationResponseDto,
  CreateAccessInvitationDto,
  CreateTeamInvitationDto,
  CreateTeamInvitationResponseDto,
  ListAccessInvitationsQueryDto,
  TeamInvitationDetailsResponseDto,
  TeamInvitationRole,
  TeamInvitationResponseDto,
} from "@repo/dto";
import { createHash, randomUUID } from "node:crypto";
import { HTTPException } from "hono/http-exception";
import type { EntityManager } from "typeorm";
import { productAccessService } from "../../common/access-control/product-access.service.js";
import {
  AccessControlService,
  accessControlService,
} from "../../common/access-control/access-control.service.js";
import { CAPABILITIES } from "../../common/access-control/capabilities.js";
import { env } from "../../common/config/config.js";
import { generateRandomString } from "../../common/util/random-string.js";
import { smtpTransporter } from "../../provider/smtp/smtp-config.js";
import {
  AccessInvitationRepository,
  accessInvitationRepository,
} from "./access-invitation.repository.js";

/** 제품 파일럿과 조직 초대의 발급, 검증, 수락을 조정합니다. */
export class AccessInvitationService {
  constructor(
    private readonly repository: AccessInvitationRepository = accessInvitationRepository,
    private readonly mailer: SignupMailer = smtpTransporter,
    private readonly productAccess: Pick<
      typeof productAccessService,
      "grantUser"
    > = productAccessService,
    private readonly accessControl: Pick<
      AccessControlService,
      "assertOrganizationCapability"
    > = accessControlService,
  ) {}

  /** 조직 관리자가 팀 초대를 만들고 대상 이메일로 초대 링크를 전송합니다. */
  async createTeamInvitation(
    actorUserId: string,
    organizationId: string,
    input: CreateTeamInvitationDto,
  ): Promise<CreateTeamInvitationResponseDto> {
    await this.assertCanManageOrganization(actorUserId, organizationId);
    const organization = await this.repository.findOrganization(organizationId);
    if (!organization) {
      throw new HTTPException(404, { message: ERROR_CODES.ORG_NOT_FOUND });
    }

    const email = this.normalizeEmail(input.email);
    if (
      await this.repository.isOrganizationMemberEmail(organizationId, email)
    ) {
      throw new HTTPException(409, {
        message: ERROR_CODES.ORGANIZATION_MEMBER_EXISTS,
      });
    }

    const code = randomUUID();
    const invitation = await this.repository.createOrganization({
      email,
      tokenHash: this.hashToken(code),
      invitedByUserId: actorUserId,
      expiresAt: new Date(
        Date.now() + input.expiresInHours * 60 * 60 * 1_000,
      ),
      organizationId,
      role: input.role,
    });

    try {
      await this.mailer.sendMail({
        from: env.SMTP_FROM_EMAIL,
        to: email,
        subject: `You are invited to ${organization.name} on Lynx`,
        html: this.createTeamInvitationEmailHtml(
          code,
          organization.name,
          invitation.expiresAt,
        ),
      });
    } catch {
      await this.repository.deletePending(invitation.id).catch(() => undefined);
      throw new HTTPException(500, {
        message: ERROR_CODES.COULD_NOT_SEND_EMAIL,
      });
    }

    return {
      ...this.toTeamResponse(invitation),
      invitationUrl: this.getTeamInvitationUrl(code),
    };
  }

  /** 조직 설정 화면에 표시할 팀 초대 내역을 조회합니다. */
  async listTeamInvitations(
    actorUserId: string,
    organizationId: string,
  ): Promise<{ items: TeamInvitationResponseDto[] }> {
    await this.accessControl.assertOrganizationCapability({
      userId: actorUserId,
      organizationId,
      capability: CAPABILITIES.ORGANIZATION_READ,
    });
    const invitations =
      await this.repository.listOrganization(organizationId);
    return { items: invitations.map((item) => this.toTeamResponse(item)) };
  }

  /** 아직 수락되지 않은 조직 초대를 취소합니다. */
  async revokeTeamInvitation(
    actorUserId: string,
    organizationId: string,
    invitationId: string,
  ): Promise<{ success: true }> {
    await this.assertCanManageOrganization(actorUserId, organizationId);
    if (
      !(await this.repository.revokeOrganization(
        organizationId,
        invitationId,
      ))
    ) {
      throw new HTTPException(404, {
        message: ERROR_CODES.TEAM_INVITATION_NOT_FOUND,
      });
    }
    return { success: true };
  }

  /** 공개 초대 화면에 필요한 최소 조직 정보만 반환합니다. */
  async getTeamInvitation(
    code: string,
  ): Promise<TeamInvitationDetailsResponseDto> {
    const invitation = await this.findTeamInvitationOrThrow(code);
    const organization = await this.repository.findOrganization(
      invitation.targetId!,
    );
    if (!organization) {
      throw new HTTPException(404, {
        message: ERROR_CODES.TEAM_INVITATION_NOT_FOUND,
      });
    }
    return {
      organizationId: organization.id,
      organizationName: organization.name,
      emailHint: this.maskEmail(invitation.email),
      role: this.getTeamRole(invitation.role),
      status: ACCESS_INVITATION_STATUS.PENDING,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  /**
   * 이메일 인증 시작 전에 팀 초대 코드와 가입 이메일을 함께 검증합니다.
   * 검증 결과는 가입 단계에 보관되어 임의의 조직 ID로 가입하는 것을 막습니다.
   */
  async resolveTeamSignupInvitation(
    email: string,
    code: string,
  ): Promise<{
    invitationId: string;
    organizationId: string;
    role: TeamInvitationRole;
  }> {
    const invitation = await this.findTeamInvitationOrThrow(code);
    if (invitation.email !== this.normalizeEmail(email)) {
      throw new HTTPException(403, {
        message: ERROR_CODES.TEAM_INVITATION_EMAIL_MISMATCH,
      });
    }
    return {
      invitationId: invitation.id,
      organizationId: invitation.targetId!,
      role: this.getTeamRole(invitation.role),
    };
  }

  /** 로그인한 사용자가 초대를 수락하면 조직 멤버십을 원자적으로 추가합니다. */
  async acceptTeamInvitation(
    userId: string,
    code: string,
  ): Promise<AcceptTeamInvitationResponseDto> {
    const pendingInvitation = await this.findTeamInvitationOrThrow(code);
    const organization = await this.repository.findOrganization(
      pendingInvitation.targetId!,
    );
    if (!organization) {
      throw new HTTPException(404, {
        message: ERROR_CODES.TEAM_INVITATION_NOT_FOUND,
      });
    }

    await this.repository.transaction(async (manager) => {
      const user = await this.repository.findUser(manager, userId);
      if (!user) {
        throw new HTTPException(404, { message: ERROR_CODES.USER_NOT_FOUND });
      }
      if (user.email !== pendingInvitation.email) {
        throw new HTTPException(403, {
          message: ERROR_CODES.TEAM_INVITATION_EMAIL_MISMATCH,
        });
      }

      const invitation = await this.repository.accept(
        manager,
        pendingInvitation.id,
        user.email,
        user.id,
      );
      if (
        !invitation ||
        invitation.targetType !==
          ACCESS_INVITATION_TARGET_TYPE.ORGANIZATION ||
        !invitation.targetId
      ) {
        throw new HTTPException(409, {
          message: ERROR_CODES.TEAM_INVITATION_NOT_FOUND,
        });
      }

      await this.repository.addOrganizationMember(manager, {
        organizationId: invitation.targetId,
        user,
        role: this.getTeamRole(invitation.role),
      });
      await this.productAccess.grantUser(
        manager,
        user.id,
        invitation.invitedByUserId,
      );
    });

    return {
      organizationId: organization.id,
      organizationName: organization.name,
      redirectTo: "/dashboard",
    };
  }

  /** 관리자 요청으로 일회용 초대를 만들고 대상 이메일로 링크를 전송합니다. */
  async create(
    actorUserId: string,
    input: CreateAccessInvitationDto,
  ): Promise<AccessInvitationResponseDto> {
    const email = this.normalizeEmail(input.email);
    const organizationPlan = await this.repository.findActiveOrganizationPlan(
      input.organizationPlanId,
    );
    if (!organizationPlan) {
      throw new HTTPException(404, {
        message: ERROR_CODES.ADMIN_PLAN_NOT_FOUND,
      });
    }
    const token = generateRandomString(48);
    const invitation = await this.repository.create({
      email,
      tokenHash: this.hashToken(token),
      invitedByUserId: actorUserId,
      organizationPlanId: organizationPlan.id,
      expiresAt: new Date(Date.now() + input.expiresInHours * 60 * 60 * 1_000),
    });

    try {
      await this.mailer.sendMail({
        from: env.SMTP_FROM_EMAIL,
        to: email,
        subject: "You are invited to the Lynx pilot",
        html: this.createInvitationEmailHtml(
          token,
          invitation.expiresAt,
          organizationPlan.name,
        ),
      });
    } catch {
      await this.repository.deletePending(invitation.id).catch(() => undefined);
      throw new HTTPException(500, {
        message: ERROR_CODES.COULD_NOT_SEND_EMAIL,
      });
    }

    return this.toResponse(invitation);
  }

  /** 관리자가 상태별 초대 내역을 cursor 방식으로 조회합니다. */
  async list(input: ListAccessInvitationsQueryDto) {
    const cursor = input.cursor
      ? this.decodeCursor(input.cursor)
      : undefined;
    const rows = await this.repository.list({
      status: input.status as AccessInvitationStatus | undefined,
      cursor,
      limit: input.limit,
    });
    const hasNext = rows.length > input.limit;
    const items = rows.slice(0, input.limit);
    return {
      items: items.map((item) => this.toResponse(item)),
      nextCursor: hasNext
        ? this.encodeCursor(items[items.length - 1]!)
        : null,
    };
  }

  /** 사용되지 않은 초대를 취소합니다. */
  async revoke(invitationId: string): Promise<{ success: true }> {
    if (!(await this.repository.revoke(invitationId))) {
      throw new HTTPException(404, {
        message: ERROR_CODES.ACCESS_INVITATION_NOT_FOUND,
      });
    }
    return { success: true };
  }

  /**
   * 이메일 인증을 시작하기 전에 초대 토큰과 이메일을 함께 확인합니다.
   *
   * PUBLIC 모드에서는 초대 없이 가입할 수 있지만, 전달된 초대가 있다면 동일하게
   * 검증하고 수락 기록을 남깁니다.
   */
  async resolveSignupInvitation(
    email: string,
    token?: string,
  ): Promise<string | null> {
    if (!token) {
      if (env.SIGNUP_MODE === PRODUCT_ACCESS_MODE.INVITE_ONLY) {
        throw new HTTPException(403, {
          message: ERROR_CODES.SIGNUP_INVITATION_REQUIRED,
        });
      }
      return null;
    }

    const invitation = await this.repository.findPending(
      this.hashToken(token),
      this.normalizeEmail(email),
    );
    if (!invitation) {
      throw new HTTPException(403, {
        message: ERROR_CODES.INVALID_ACCESS_INVITATION,
      });
    }
    return invitation.id;
  }

  /** 새 설치에서 첫 관리자가 초대 API를 열 수 있도록 지정 이메일을 확인합니다. */
  isBootstrapAdminEmail(email: string): boolean {
    return (
      env.SIGNUP_MODE === PRODUCT_ACCESS_MODE.INVITE_ONLY &&
      env.PILOT_BOOTSTRAP_ADMIN_EMAIL !== undefined &&
      this.normalizeEmail(email) === env.PILOT_BOOTSTRAP_ADMIN_EMAIL
    );
  }

  /** 첫 관리자 가입과 같은 트랜잭션에서 제품 권한과 관리자 역할을 부여합니다. */
  async activateBootstrapAdmin(
    manager: EntityManager,
    userId: string,
  ): Promise<void> {
    await this.productAccess.grantUser(manager, userId, null);
    const repository = manager.getRepository(AdminUserEntity);
    const existing = await repository.findOne({
      where: { user: { id: userId } },
      relations: { user: true },
    });
    if (existing) {
      existing.isActive = true;
      await repository.save(existing);
      return;
    }
    await repository.save(
      repository.create({
        role: ADMIN_ROLES.SUPER_ADMIN,
        isActive: true,
        user: { id: userId },
      }),
    );
  }

  /** 계정 생성과 같은 트랜잭션에서 초대를 소비하고 사용자 권한을 부여합니다. */
  async acceptSignupInvitation(
    manager: EntityManager,
    invitationId: string,
    email: string,
    userId: string,
  ): Promise<{ organizationPlanId: string | null }> {
    const invitation = await this.repository.accept(
      manager,
      invitationId,
      email,
      userId,
    );
    if (!invitation) {
      throw new HTTPException(409, {
        message: ERROR_CODES.INVALID_ACCESS_INVITATION,
      });
    }
    await this.productAccess.grantUser(
      manager,
      userId,
      invitation.invitedByUserId,
    );
    return { organizationPlanId: invitation.organizationPlanId };
  }

  /** 비교 전에 이메일의 대소문자와 주변 공백을 정규화합니다. */
  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /** DB 유출 시 초대 링크가 바로 노출되지 않도록 토큰 해시만 저장합니다. */
  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  /** 초대 URL과 만료 시각을 포함한 최소 HTML 메일을 생성합니다. */
  private createInvitationEmailHtml(
    token: string,
    expiresAt: Date,
    organizationPlanName: string,
  ): string {
    const frontendUrl = env.FRONTEND_URL.replace(/\/$/, "");
    const invitationUrl = `${frontendUrl}/signup?invite=${encodeURIComponent(token)}`;
    return [
      "<p>You have been invited to the Lynx pilot.</p>",
      `<p>Your first organization will use the ${this.escapeHtml(organizationPlanName)} plan.</p>`,
      `<p><a href="${invitationUrl}">Accept invitation</a></p>`,
      `<p>This invitation expires at ${expiresAt.toISOString()}.</p>`,
    ].join("");
  }

  /** 조직 초대 화면으로 이동하는 메일 본문을 생성합니다. */
  private createTeamInvitationEmailHtml(
    code: string,
    organizationName: string,
    expiresAt: Date,
  ): string {
    const invitationUrl = this.getTeamInvitationUrl(code);
    return [
      `<p>You have been invited to ${this.escapeHtml(organizationName)} on Lynx.</p>`,
      `<p><a href="${invitationUrl}">Accept invitation</a></p>`,
      `<p>This invitation expires at ${expiresAt.toISOString()}.</p>`,
    ].join("");
  }

  /** 초대 생성 응답과 메일이 같은 링크를 사용하도록 URL 생성을 통합합니다. */
  private getTeamInvitationUrl(code: string): string {
    const frontendUrl = env.FRONTEND_URL.replace(/\/$/, "");
    return `${frontendUrl}/invite?code=${encodeURIComponent(code)}`;
  }

  /** 조직 초대 엔티티를 외부 응답 형식으로 제한합니다. */
  private toTeamResponse(
    invitation: AccessInvitationEntity,
  ): TeamInvitationResponseDto {
    return {
      id: invitation.id,
      email: invitation.email,
      role: this.getTeamRole(invitation.role),
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
      createdAt: invitation.createdAt.toISOString(),
    };
  }

  /** 초대 코드를 해시로 바꿔 현재 수락 가능한 조직 초대를 조회합니다. */
  private async findTeamInvitationOrThrow(
    code: string,
  ): Promise<AccessInvitationEntity> {
    const invitation = await this.repository.findPendingOrganization(
      this.hashToken(code),
    );
    if (
      !invitation ||
      invitation.targetType !== ACCESS_INVITATION_TARGET_TYPE.ORGANIZATION ||
      !invitation.targetId
    ) {
      throw new HTTPException(404, {
        message: ERROR_CODES.TEAM_INVITATION_NOT_FOUND,
      });
    }
    return invitation;
  }

  /** DB 문자열을 허용된 조직 역할로 좁힙니다. */
  private getTeamRole(role: string | null): TeamInvitationRole {
    if (
      role === USER_PERMISSIONS.ADMIN ||
      role === USER_PERMISSIONS.MEMBER ||
      role === USER_PERMISSIONS.VIEWER
    ) {
      return role;
    }
    throw new HTTPException(409, {
      message: ERROR_CODES.INVALID_ACCESS_INVITATION,
    });
  }

  /** 초대 공개 화면에서는 이메일 전체 대신 일부만 표시합니다. */
  private maskEmail(email: string): string {
    const [localPart, domain] = email.split("@");
    const visible = localPart?.slice(0, 2) ?? "";
    return `${visible}${"*".repeat(Math.max((localPart?.length ?? 0) - 2, 2))}@${domain}`;
  }

  /** 메일 HTML에 조직 이름을 안전하게 삽입합니다. */
  private escapeHtml(value: string): string {
    return value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character]!,
    );
  }

  /** 조직 초대를 관리할 수 있는 역할인지 확인합니다. */
  private assertCanManageOrganization(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    return this.accessControl.assertOrganizationCapability({
      userId,
      organizationId,
      capability: CAPABILITIES.ORGANIZATION_UPDATE,
    });
  }

  /** 저장 엔티티를 외부에 노출 가능한 응답으로 제한합니다. */
  private toResponse(
    invitation: AccessInvitationEntity,
  ): AccessInvitationResponseDto {
    return {
      id: invitation.id,
      email: invitation.email,
      organizationPlanId: invitation.organizationPlanId,
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
      createdAt: invitation.createdAt.toISOString(),
    };
  }

  /** 최신순 cursor를 TypeORM 조회 조건으로 복원합니다. */
  private decodeCursor(cursor: string): { createdAt: Date; id: string } {
    const separator = cursor.lastIndexOf("|");
    return {
      createdAt: new Date(cursor.slice(0, separator)),
      id: cursor.slice(separator + 1),
    };
  }

  /** 마지막 항목의 생성 시각과 ID를 다음 페이지 cursor로 만듭니다. */
  private encodeCursor(invitation: AccessInvitationEntity): string {
    return `${invitation.createdAt.toISOString()}|${invitation.id}`;
  }
}

/** 회원가입과 관리자 API가 공유하는 초대 서비스입니다. */
export const accessInvitationService = new AccessInvitationService();
