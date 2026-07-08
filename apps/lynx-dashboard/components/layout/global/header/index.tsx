import { PageBreadcrumbBar } from "@/components/page-info";

export default function DashboardHeader() {
  return (
    <div className="pt-8 pb-5 pl-5 flex justify-between items-center">
      <div className="flex items-center">
        <div className="h-10"></div>
        <PageBreadcrumbBar />
      </div>
    </div>
  );
}
