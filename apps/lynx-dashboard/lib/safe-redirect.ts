const DEFAULT_REDIRECT = "/dashboard";

/**
 * Returns a same-origin path that is safe to use after authentication.
 * Absolute URLs, protocol-relative URLs, and backslash variants are rejected.
 */
export function getSafeRedirect(
  value: string | null | undefined,
  fallback = DEFAULT_REDIRECT,
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || decoded.includes("\\")) return fallback;

    const parsed = new URL(value, "https://lynx.local");
    if (parsed.origin !== "https://lynx.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

/** Adds a validated destination to an authentication page URL. */
export function withRedirect(path: string, redirectPath: string): string {
  const query = new URLSearchParams({
    redirects: getSafeRedirect(redirectPath),
  });
  return `${path}?${query.toString()}`;
}

/** Returns the current browser path without exposing the origin. */
export function getCurrentRedirectPath(): string {
  if (typeof window === "undefined") return DEFAULT_REDIRECT;
  return getSafeRedirect(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  );
}
