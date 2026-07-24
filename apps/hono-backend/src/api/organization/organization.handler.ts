import { zValidator } from "@hono/zod-validator";
import { ORGANIZATION_CREATION_SOURCES } from "@repo/constants";
import { organizationContract } from "@repo/contract";
import { randomUUID } from "node:crypto";
import { createFactory } from "hono/factory";
import { z } from "zod";
import type { AppEnv } from "../../common/types/app-env.js";
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
        organization satisfies z.infer<
          typeof organizationContract.create.response
        >,
        201,
      );
    },
  );

  return { createOrg };
}
