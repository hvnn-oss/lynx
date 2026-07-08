"use client";
import { ArrowRight, Inbox } from "lucide-react";
import { Button, buttonVariants } from "@repo/ui/components/ui/button";
import Link from "next/link";

export function NoDataScreen() {
  const refresh = () => {
    window.location.reload();
  };
  return (
    <main className="w-full h-full flex flex-col items-center justify-center gap-5">
      <div className="p-3 rounded-full bg-accent">
        <Inbox className="size-15" strokeWidth={1.3} />
      </div>
      <div className="text-center flex flex-col items-center gap-5">
        <div>
          <h1 className="text-lg font-bold">
            수집된 데이터가 존재하지 않습니다.
          </h1>
          <p className="text-sm">
            데이터가 수집된 이후, 나중에 다시 시도해 보세요.
          </p>
        </div>
        <div className="flex gap-1">
          <Link
            href={"https://docs.lynxops.co/"}
            className={buttonVariants({
              variant: "default",
              className: "border-border border group",
            })}
          >
            데이터 수집하기
            <ArrowRight className="group-hover:ml-2 transition-all duration-300" />
          </Link>
          <Button className="" variant={"outline"} onClick={refresh}>
            세로고침
          </Button>
        </div>
      </div>
    </main>
  );
}
