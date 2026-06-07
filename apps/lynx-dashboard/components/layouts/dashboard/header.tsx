import { LynxLogo } from "@repo/ui/components/brands/lynx-logo";
import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";

export default function DashboardHeader() {
  return (
    <header className="p-5 flex justify-between items-center">
      <div className="flex items-center gap-5">
        <Link href={"https://lynx.com/"}>
          <LynxLogo className="size-10" />
        </Link>
        <div>
          <p>이슈 / 에이전트-faf</p>
        </div>
      </div>
      <div>
        <Button variant={"outline"}>Search</Button>
      </div>
    </header>
  );
}
