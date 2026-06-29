import type { AdminOrganizationSearchResponse } from "@/lib/admin-types";
import { adminFetch } from "@/lib/backend";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query") ?? "";
  const limit = request.nextUrl.searchParams.get("limit") ?? "10";
  const params = new URLSearchParams({ query, limit });

  const response = await adminFetch<AdminOrganizationSearchResponse>(
    `/admin/organizations/search?${params.toString()}`,
  );

  return NextResponse.json(response);
}
