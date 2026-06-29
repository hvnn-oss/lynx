import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ADMIN_ACCESS_TOKEN_COOKIE = "lynx_admin_access_token";

export function getBackendUrl() {
  const backendUrl = process.env.BACKEND_URL;

  if (!backendUrl) {
    throw new Error("BACKEND_URL is not configured.");
  }

  return backendUrl.replace(/\/$/, "");
}

export async function getAdminAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_ACCESS_TOKEN_COOKIE)?.value;
}

export async function setAdminAccessToken(accessToken: string) {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearAdminAccessToken() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_ACCESS_TOKEN_COOKIE);
}

export async function adminFetch<TResponse>(
  path: string,
  init?: RequestInit,
): Promise<TResponse> {
  const token = await getAdminAccessToken();

  if (!token) {
    redirect("/login");
  }

  const backendUrl = getBackendUrl();
  let response: Response;

  try {
    response = await fetch(`${backendUrl}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    });
  } catch (error) {
    throw new Error(
      `Admin backend is not reachable at ${backendUrl}. Start the backend dev server or update BACKEND_URL. ${String(error)}`,
    );
  }

  if (response.status === 401 || response.status === 403) {
    redirect("/login?error=forbidden");
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Admin request failed: ${response.status}`);
  }

  return (await response.json()) as TResponse;
}
