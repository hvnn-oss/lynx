import DashboardHeader from "./header";
import DashboardSidebar from "./sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="bg-linear-to-b from-background from-50% to-indigo-500/40 w-screen h-screen relative flex flex-col overflow-hidden">
      <div className="w-screen flex flex-1 max-h-full">
        <DashboardSidebar />
        <div className="flex flex-col flex-1 h-full min-w-0">
          <DashboardHeader />
          <div className="bg-accent min-h-0 w-full flex-1 overflow-hidden rounded-tl-md border-l border-t border-borders">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
