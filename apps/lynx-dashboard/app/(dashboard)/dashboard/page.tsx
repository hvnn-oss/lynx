import { redirect } from "next/navigation";

export default function DashboardMainPage() {
  redirect("/dashboard/overview");
}
