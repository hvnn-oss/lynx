import { zValidator } from "@hono/zod-validator";
import { ORGANIZATION_CREATION_SOURCES } from "@repo/constants";
import { organizationContract } from "@repo/contract";
import { OrganizationIdParamsSchema } from "@repo/dto";
import { randomUUID } from "node:crypto";
import { createFactory } from "hono/factory";
import { z } from "zod";
import type { AppEnv } from "../../common/types/app-env.js";
import { readImageUpload } from "../../common/util/read-image-upload.js";
import { accessInvitationService } from "../access-invitation/access-invitation.service.js";
import { orgService } from "./organization.service.js";

const factory = createFactory<AppEnv>();

/**
 * 조직 API의 입력 검증과 HTTP 응답 처리를 구성합니다.
 * @returns 라우터에 등록할 조직 생성 핸들러입니다.
 */
export function createOrgHandlers() {
  /** 인증된 사용자가 참여 중인 조직을 조회합니다. */
  const listOrganizations = factory.createHandlers(async (c) =>
    c.json(
      organizationContract.list.response.parse(
        await orgService.listOrganizations(c.get("currentUserId")),
      ),
    ),
  );

  /** 사용자 한도와 멱등성 키를 확인해 새 조직을 생성합니다. */
  const createOrg = factory.createHandlers(
    zValidator("json", organizationContract.create.request),
    async (c) => {
      const request = c.req.valid("json");
      const idempotencyKey = c.req.header("Idempotency-Key");
      // 올바른 UUID 키만 멱등성 값으로 사용하고 나머지는 새 요청으로 처리합니다.
      const requestId = z.uuid().safeParse(idempotencyKey).success
        ? (idempotencyKey as string)
        : randomUUID();
      const organization = await orgService.createOrganization({
        userId: c.get("currentUserId"),
        name: request.name,
        requestId,
        source: ORGANIZATION_CREATION_SOURCES.DASHBOARD,
      });

      return c.json(
        organizationContract.create.response.parse(organization),
        201,
      );
    },
  );

  const getProfile = factory.createHandlers(
    zValidator("param", OrganizationIdParamsSchema),
    async (c) => {
      const { organizationId } = c.req.valid("param");
      const profile = await orgService.getProfile({
        userId: c.get("currentUserId"),
        organizationId,
      });
      return c.json(organizationContract.getProfile.response.parse(profile));
    },
  );

  const updateProfile = factory.createHandlers(
    zValidator("param", OrganizationIdParamsSchema),
    zValidator("json", organizationContract.updateProfile.request),
    async (c) => {
      const { organizationId } = c.req.valid("param");
      const profile = await orgService.updateProfile({
        userId: c.get("currentUserId"),
        organizationId,
        profile: c.req.valid("json"),
      });
      return c.json(organizationContract.updateProfile.response.parse(profile));
    },
  );

  const listMembers = factory.createHandlers(
    zValidator("param", OrganizationIdParamsSchema),
    async (c) => {
      const { organizationId } = c.req.valid("param");
      return c.json(
        organizationContract.listMembers.response.parse(
          await orgService.listMembers({
            userId: c.get("currentUserId"),
            organizationId,
          }),
        ),
      );
    },
  );

  /** 조직 관리자가 새 팀 초대를 발급합니다. */
  const createInvitation = factory.createHandlers(
    zValidator("param", organizationContract.createInvitation.params!),
    zValidator("json", organizationContract.createInvitation.request),
    async (c) => {
      const { organizationId } = c.req.valid("param");
      const invitation = await accessInvitationService.createTeamInvitation(
        c.get("currentUserId"),
        organizationId,
        c.req.valid("json"),
      );
      return c.json(
        organizationContract.createInvitation.response.parse(invitation),
        201,
      );
    },
  );

  /** 조직에 발급된 팀 초대 내역을 조회합니다. */
  const listInvitations = factory.createHandlers(
    zValidator("param", organizationContract.listInvitations.params!),
    async (c) => {
      const { organizationId } = c.req.valid("param");
      const invitations = await accessInvitationService.listTeamInvitations(
        c.get("currentUserId"),
        organizationId,
      );
      return c.json(
        organizationContract.listInvitations.response.parse(invitations),
      );
    },
  );

  /** 수락 전인 팀 초대를 취소합니다. */
  const revokeInvitation = factory.createHandlers(
    zValidator("param", organizationContract.revokeInvitation.params!),
    async (c) => {
      const { organizationId, invitationId } = c.req.valid("param");
      const response = await accessInvitationService.revokeTeamInvitation(
        c.get("currentUserId"),
        organizationId,
        invitationId,
      );
      return c.json(
        organizationContract.revokeInvitation.response.parse(response),
      );
    },
  );

  const uploadProfileImage = factory.createHandlers(
    zValidator("param", OrganizationIdParamsSchema),
    async (c) => {
      const { organizationId } = c.req.valid("param");
      const upload = await readImageUpload(c);
      const image = await orgService.uploadProfileImage({
        userId: c.get("currentUserId"),
        organizationId,
        upload,
      });
      return c.json(
        organizationContract.uploadProfileImage.response.parse(image),
      );
    },
  );

  return {
    listOrganizations,
    createOrg,
    createInvitation,
    getProfile,
    listInvitations,
    updateProfile,
    listMembers,
    revokeInvitation,
    uploadProfileImage,
  };
}
