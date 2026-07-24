import { ERROR_CODES } from "@repo/constants";
import { verify } from "hono/jwt";
import { createMiddleware } from "hono/factory";
import { env } from "../config/config.js";
import { UnauthorizedErrorException } from "../exceptions/unauthorized.js";
import type { AppEnv } from "../types/app-env.js";

/** Bearer Access Token을 검증하고 현재 사용자 식별자를 요청 컨텍스트에 저장합니다. */
export const requireAccessToken = createMiddleware<AppEnv>(async (c, next) => {
  const authorization = c.req.header("Authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    throw new UnauthorizedErrorException(ERROR_CODES.TOKEN_EXPIRED);
  }

  try {
    const payload = await verify(token, env.JWT_SECRET, "HS256");
    if (
      payload.typ !== "access" ||
      typeof payload.sub !== "string" ||
      payload.sub.length === 0
    ) {
      throw new Error("Invalid access token payload");
    }

    c.set("currentUserId", payload.sub);
    await next();
  } catch {
    throw new UnauthorizedErrorException(ERROR_CODES.TOKEN_EXPIRED);
  }
});
