import DashboardLayout from "@/components/layout/global/layout";
import SidebarInner from "@/components/layout/global/sidebar/sidebar-inner";
import AuthGuard from "@/components/util/auth-guard";

export default function DashboardPageLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="flex w-full h-full overflow-hidden">
          <SidebarInner />
          <div className="flex-1 min-h-0 overflow-y-scroll">{children}</div>
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}
