"use client";
import { LynxLogo } from "@repo/ui/components/brands/lynx-logo";
import { Button } from "@repo/ui/components/ui/button";
import { Search } from "lucide-react";
import Link from "next/link";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@repo/ui/components/ui/avatar";
import { usePageStore } from "@/stores/pageStore";

export function DashboardHeader() {
  const pageTitle = usePageStore((state) => state.title);
  return (
    <header className="p-10 flex justify-between items-center">
      <div className="flex items-center gap-5">
        <Link
          href={"/"}
          className="flex gap-3 items-center text-2xl select-none"
        >
          <LynxLogo className="size-10" />
        </Link>
        <div>
          <p>{pageTitle}</p>
        </div>
      </div>
      <div className="flex gap-5 items-center">
        <div className="flex gap-2">
          <Button variant={"outline"}>기술 문서</Button>
          <Button variant={"outline"} className="pr-4">
            <Search />
            Search
          </Button>
        </div>
        <Avatar>
          <AvatarImage src="https://github.com/shadcn.png" />
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
