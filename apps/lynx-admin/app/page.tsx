import { AdminShell } from "@/components/admin-shell";
import AdminOverviewPage from "@/components/overview-page";

export default function HomePage() {
  return (
    <AdminShell>
      <AdminOverviewPage />
    </AdminShell>
  );
}
