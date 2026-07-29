const TOKEN_REFRESH_BUFFER_SECONDS = 30;

let inMemoryAccessToken: string | null = null;

/**
 * Returns the access token held by the current browser document.
 *
 * The token intentionally stays out of localStorage and sessionStorage so a
 * later page load must restore the session through the HttpOnly refresh cookie.
 */
export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

/** Replaces the access token held in memory for subsequent API requests. */
export function setAccessToken(accessToken: string): void {
  inMemoryAccessToken = accessToken;
}

/** Removes the in-memory access token without touching the HttpOnly cookie. */
export function clearAccessToken(): void {
  inMemoryAccessToken = null;
}

/** Returns true when a JWT is invalid or too close to expiration. */
export function isAccessTokenExpired(accessToken: string): boolean {
  const payload = decodeJwtPayload(accessToken);
  if (!payload?.exp) return true;

  const nowSeconds = Math.floor(Date.now() / 1_000);
  return payload.exp <= nowSeconds + TOKEN_REFRESH_BUFFER_SECONDS;
}

function decodeJwtPayload(accessToken: string): { exp?: number } | null {
  try {
    const [, payload] = accessToken.split(".");
    if (!payload) return null;

    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "=",
    );

    return JSON.parse(globalThis.atob(paddedPayload)) as { exp?: number };
  } catch {
    return null;
  }
}
