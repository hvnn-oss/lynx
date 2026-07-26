import { zValidator } from "@hono/zod-validator";
import { ORGANIZATION_CREATION_SOURCES } from "@repo/constants";
import { organizationContract } from "@repo/contract";
import { OrganizationIdParamsSchema } from "@repo/dto";
import { randomUUID } from "node:crypto";
import { createFactory } from "hono/factory";
import { z } from "zod";
import type { AppEnv } from "../../common/types/app-env.js";
import { readImageUpload } from "../../common/util/read-image-upload.js";
import { orgService } from "./organization.service.js";

const factory = createFactory<AppEnv>();

/**
 * 조직 API의 입력 검증과 HTTP 응답 처리를 구성합니다.
 * @returns 라우터에 등록할 조직 생성 핸들러입니다.
 */
export function createOrgHandlers() {
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
    createOrg,
    getProfile,
    updateProfile,
    listMembers,
    uploadProfileImage,
  };
}
