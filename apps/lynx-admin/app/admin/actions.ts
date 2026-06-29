"use server";

import type {
  AdminCreatePlan,
  AdminOrganization,
  AdminPlan,
  AdminUpdateOrganization,
  AdminUpdatePlan,
  AdminUpdateUser,
  AdminUpdateWorkspace,
  AdminUser,
  AdminWorkspace,
} from "@/lib/admin-types";
import { revalidatePath } from "next/cache";
import { adminFetch } from "@/lib/backend";

const ADMIN_PATH = "/admin";

export async function updatePlan(formData: FormData) {
  const code = readString(formData, "code");
  const body: AdminUpdatePlan = {
    name: readString(formData, "name"),
    retentionDays: readRequiredNumber(formData, "retentionDays"),
    monthlyEventLimit: readOptionalNumber(formData, "monthlyEventLimit"),
    includedLogCount: readOptionalNumber(formData, "includedLogCount"),
    logOverageUnitPrice: readOptionalNumber(formData, "logOverageUnitPrice"),
    features: readJsonObject(formData, "features"),
    isActive: formData.get("isActive") === "on",
  };

  await adminFetch<AdminPlan>(`/admin/plans/${code}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  revalidatePath(ADMIN_PATH);
}

export async function createPlan(formData: FormData) {
  const body: AdminCreatePlan = {
    code: readString(formData, "code"),
    name: readString(formData, "name"),
    retentionDays: readRequiredNumber(formData, "retentionDays"),
    monthlyEventLimit: readOptionalNumber(formData, "monthlyEventLimit"),
    includedLogCount: readOptionalNumber(formData, "includedLogCount"),
    logOverageUnitPrice: readOptionalNumber(formData, "logOverageUnitPrice"),
    features: readJsonObject(formData, "features"),
    isActive: formData.get("isActive") === "on",
  };

  await adminFetch<AdminPlan>("/admin/plans", {
    method: "POST",
    body: JSON.stringify(body),
  });
  revalidatePath(ADMIN_PATH);
}

export async function updateUser(formData: FormData) {
  const userId = readString(formData, "id");
  const body: AdminUpdateUser = {
    email: readString(formData, "email"),
    name: readString(formData, "name"),
  };

  await adminFetch<AdminUser>(`/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  revalidatePath(ADMIN_PATH);
}

export async function updateOrganization(formData: FormData) {
  const organizationId = readString(formData, "id");
  const body: AdminUpdateOrganization = {
    name: readString(formData, "name"),
    useSso: formData.get("useSso") === "on",
    forceSSO: formData.get("forceSSO") === "on",
    oidcIssuer: readOptionalString(formData, "oidcIssuer"),
    oidcClientId: readOptionalString(formData, "oidcClientId"),
  };

  await adminFetch<AdminOrganization>(
    `/admin/organizations/${organizationId}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
  revalidatePath(ADMIN_PATH);
}

export async function updateWorkspace(formData: FormData) {
  const workspaceId = readString(formData, "id");
  const body: AdminUpdateWorkspace = {
    name: readString(formData, "name"),
    organizationId: readString(formData, "organizationId"),
    plan: readString(formData, "plan"),
  };

  await adminFetch<AdminWorkspace>(`/admin/workspaces/${workspaceId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  revalidatePath(ADMIN_PATH);
}

function readString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

function readOptionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || undefined;
}

function readRequiredNumber(formData: FormData, key: string) {
  const value = Number(readString(formData, key));

  if (!Number.isFinite(value)) {
    throw new Error(`${key} must be a number.`);
  }

  return value;
}

function readOptionalNumber(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${key} must be a number.`);
  }

  return parsed;
}

function readJsonObject(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "{}").trim() || "{}";
  const parsed: unknown = JSON.parse(value);

  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`${key} must be a JSON object.`);
  }

  return parsed as Record<string, unknown>;
}
