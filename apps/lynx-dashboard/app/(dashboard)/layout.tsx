import DashboardFooter from "@/components/layouts/dashboard/footer";
import { DashboardHeader } from "@/components/layouts/dashboard/header";
import { DashboardSidebar } from "@/components/layouts/dashboard/sidebar";
import AuthGuard from "@/components/util/auth-guard";
import WorkspaceGuard from "@/components/util/workspace-guard";

// 대시보드 내부 영역 전체를 로그인 필수 상태로 제어하고 레이아웃을 구성합니다.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGuard>
      <WorkspaceGuard>
        <div className="flex">
          <DashboardSidebar />
          <div className="flex-1">
            <DashboardHeader />
            {children}
            <DashboardFooter />
          </div>
        </div>
      </WorkspaceGuard>
    </AuthGuard>
  );
}
