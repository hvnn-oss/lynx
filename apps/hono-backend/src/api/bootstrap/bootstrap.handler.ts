import { bootstrapContract } from "@repo/contract";
import { createFactory } from "hono/factory";
import type { AppEnv } from "../../common/types/app-env.js";
import { bootstrapService } from "./bootstrap.service.js";

const factory = createFactory<AppEnv>();

/** 대시보드 초기 사용자 컨텍스트 HTTP 핸들러를 구성합니다. */
export function createBootstrapHandlers() {
  const getDashboardContext = factory.createHandlers(async (context) => {
    const result = await bootstrapService.getDashboardContext(
      context.get("currentUserId"),
    );
    return context.json(bootstrapContract.get.response.parse(result));
  });

  return { getDashboardContext };
}
