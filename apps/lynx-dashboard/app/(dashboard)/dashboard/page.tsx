import { UsePageInfo } from "@/components/util/set-pageinfo";

export default function DashboardPage() {
  return (
    <main>
      <UsePageInfo breadcrumbs={[{ title: "대시보드", url: "/dashboard" }]} />
    </main>
  );
}
