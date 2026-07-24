import { organizationContract } from "@repo/contract";
import { Hono } from "hono";
import { requireAccessToken } from "../../common/middleware/access-token.middleware.js";
import type { AppEnv } from "../../common/types/app-env.js";
import { createOrgHandlers } from "./organization.handler.js";

const orgHandlers = createOrgHandlers();

export const orgRouter = new Hono<AppEnv>();

// 조직 API는 인증된 사용자만 호출할 수 있습니다.
orgRouter.use("*", requireAccessToken);
orgRouter.on(
  organizationContract.create.method,
  organizationContract.create.path,
  ...orgHandlers.createOrg,
);
