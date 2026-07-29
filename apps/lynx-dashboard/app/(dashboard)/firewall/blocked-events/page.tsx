import { redirect } from "next/navigation";

export default function BlockedEventsPage() {
  redirect("/firewall/records");
}
