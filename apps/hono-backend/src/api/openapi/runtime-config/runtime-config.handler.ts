import { createFactory } from "hono/factory";
import { openAPIContract } from "@repo/contract";
import type { AppEnv } from "../../../common/types/app-env.js";
import { runtimeConfigService } from "./runtime-config.service.js";

const factory = createFactory<AppEnv>();

/** 런타임 설정 HTTP 요청을 처리하는 핸들러 모음을 생성합니다. */
export function createRuntimeConfigHandlers() {
  const get = factory.createHandlers(async (c) => {
    const config = await runtimeConfigService.get(c.get("currentWorkspaceId"));
    const etag = `"${config.revision}"`;
    c.header("Cache-Control", "private, no-cache");
    // SDK의 캐시가 최신이면 본문 전송을 생략합니다.
    if (c.req.header("If-None-Match") === etag) {
      return c.body(null, 304);
    }

    c.header("ETag", etag);
    return c.json(openAPIContract.getRuntimeConfig.response.parse(config));
  });

  return { get };
}
