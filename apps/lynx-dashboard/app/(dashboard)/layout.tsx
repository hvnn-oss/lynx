import DashboardFooter from "@/components/layouts/dashboard/footer";
import { DashboardHeader } from "@/components/layouts/dashboard/header";
import { DashboardSidebar } from "@/components/layouts/dashboard/sidebar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex">
      <DashboardSidebar />
      <div className="flex-1">
        <DashboardHeader />
        {children}
        <DashboardFooter />
      </div>
    </div>
  );
}
