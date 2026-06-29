import DashboardFooter from "@/components/layouts/dashboard/footer";
import { DashboardHeader } from "@/components/layouts/dashboard/header";
import { DashboardSidebar } from "@/components/layouts/dashboard/sidebar";
import AuthGuard from "@/components/util/auth-guard";
import WorkspaceGuard from "@/components/util/workspace-guard";

// 대시보드 내부 영역은 로그인과 워크스페이스 선택이 끝난 뒤에만 렌더링합니다.
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
