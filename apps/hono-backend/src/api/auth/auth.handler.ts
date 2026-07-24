import { zValidator } from "@hono/zod-validator";
import { ERROR_CODES } from "@repo/constants";
import { authContract } from "@repo/contract";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createFactory } from "hono/factory";
import type { z } from "zod";
import { env } from "../../common/config/config.js";
import { UnauthorizedErrorException } from "../../common/exceptions/unauthorized.js";
import type { AppEnv } from "../../common/types/app-env.js";
import { authService } from "./auth.service.js";
import { localAuthService } from "./local.service.js";

const factory = createFactory<AppEnv>();

/**
 * 인증 API의 입력 검증과 HTTP 응답 처리를 구성합니다.
 * @returns 라우터에 등록할 회원가입, 로그인, 토큰 갱신, 로그아웃 핸들러입니다.
 */
export function createAuthHandlers() {
  /** 이메일 확인 링크를 만들고 가입 이메일로 전송합니다. */
  const createEmailVerification = factory.createHandlers(
    zValidator("json", authContract.createEmailVerification.request),
    async (c) => {
      const response = await authService.createEmailVerification(
        c.req.valid("json"),
      );
      return c.json(
        response satisfies z.infer<
          typeof authContract.createEmailVerification.response
        >,
        200,
      );
    },
  );

  /** 이메일 확인 토큰을 검증하고 가입 단계를 완료합니다. */
  const verifyEmailToken = factory.createHandlers(
    zValidator("json", authContract.verifyEmailToken.request),
    async (c) => {
      const response = await authService.verifyEmail(c.req.valid("json").token);
      return c.json(
        response satisfies z.infer<
          typeof authContract.verifyEmailToken.response
        >,
        200,
      );
    },
  );

  /** 확인된 가입 정보로 사용자와 조직 정보를 생성합니다. */
  const signUp = factory.createHandlers(
    zValidator("json", authContract.signUp.request),
    async (c) => {
      const response = await authService.register(c.req.valid("json"));
      return c.json(
        response satisfies z.infer<typeof authContract.signUp.response>,
        201,
      );
    },
  );

  /** 로컬 계정을 검증하고 로그인 토큰을 발급합니다. */
  const login = factory.createHandlers(
    zValidator("json", authContract.login.request),
    async (c) => {
      const loginDto = c.req.valid("json");
      await localAuthService.assertAllowed(c, loginDto.email);
      const identity = await localAuthService.generateLoginIdentity(loginDto);
      const completeInput = authService.buildCompleteLoginInput(c, identity, {
        expectedWorkspaceId: loginDto.expectedWorkspaceId,
      });
      const { access_token, refresh_token } =
        await authService.complete(completeInput);

      setRefreshTokenCookie(c, refresh_token);

      return c.json(
        {
          success: true,
          access_token,
        } satisfies z.infer<typeof authContract.login.response>,
        200,
      );
    },
  );

  /** 쿠키의 Refresh Token을 회전하고 새 Access Token을 반환합니다. */
  const refresh = factory.createHandlers(async (c) => {
    const refreshToken = getCookie(c, "rid");
    if (!refreshToken) {
      throw new UnauthorizedErrorException(ERROR_CODES.INVALID_REFRESH_TOKEN);
    }
    const { access_token, refresh_token } =
      await authService.refresh(refreshToken);
    setRefreshTokenCookie(c, refresh_token);

    return c.json(
      { success: true, access_token } satisfies z.infer<
        typeof authContract.refresh.response
      >,
      200,
    );
  });

  /** 현재 Refresh Token 세션을 폐기하고 브라우저 쿠키를 제거합니다. */
  const logout = factory.createHandlers(async (c) => {
    const refreshToken = getCookie(c, "rid");
    if (refreshToken) await authService.logout(refreshToken);

    deleteCookie(c, "rid", {
      secure: env.NODE_ENV === "production",
      sameSite: "Lax",
      path: authContract.basePath,
    });

    return c.json(
      { success: true } satisfies z.infer<typeof authContract.logout.response>,
      200,
    );
  });

  return {
    createEmailVerification,
    login,
    logout,
    refresh,
    signUp,
    verifyEmailToken,
  };
}

/** Refresh Token을 JavaScript에서 읽을 수 없는 전용 쿠키로 전달합니다. */
function setRefreshTokenCookie(c: Context<AppEnv>, refreshToken: string): void {
  setCookie(c, "rid", refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "Lax",
    path: authContract.basePath,
    maxAge: env.REFRESH_TOKEN_TTL_SECONDS,
  });
}
