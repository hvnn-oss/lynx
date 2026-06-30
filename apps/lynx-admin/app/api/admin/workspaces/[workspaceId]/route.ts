import type { AdminUpdateWorkspace, AdminWorkspace } from "@/lib/admin-types";
import { adminFetch } from "@/lib/backend";
import { NextResponse, type NextRequest } from "next/server";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await context.params;
  const body = (await request.json()) as AdminUpdateWorkspace;

  const workspace = await adminFetch<AdminWorkspace>(
    `/admin/workspaces/${workspaceId}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );

  return NextResponse.json(workspace);
}
