"use server";

import { redirect } from "next/navigation";
import type { AdminMe } from "@/lib/admin-types";
import {
  adminFetch,
  clearAdminAccessToken,
  getBackendUrl,
  setAdminAccessToken,
} from "@/lib/backend";

interface LoginResponse {
  success: boolean;
  accessToken?: string;
}

export async function login(formData: FormData) {
  const body = {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };

  const response = await fetch(`${getBackendUrl()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    redirect("/login?error=invalid-credentials");
  }

  const result = (await response.json()) as LoginResponse;
  if (!result.success || !result.accessToken) {
    redirect("/login?error=invalid-credentials");
  }

  await setAdminAccessToken(result.accessToken);

  try {
    await adminFetch<AdminMe>("/admin/me");
  } catch {
    await clearAdminAccessToken();
    redirect("/login?error=forbidden");
  }

  redirect("/admin");
}

export async function logout() {
  await clearAdminAccessToken();
  redirect("/login");
}
