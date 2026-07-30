export const dynamic = "force-dynamic";

/**
 * ALB와 배포 검증에서 사용하는 Admin 상태를 반환합니다.
 */
export function GET() {
  return Response.json(
    {
      status: "ok",
      service: "lynx-admin",
      releaseSha: process.env.RELEASE_SHA ?? "local",
      deployedAt: process.env.DEPLOYED_AT ?? null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
