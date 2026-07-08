import { cn } from "@/lib/utils";
import { RectangleEllipsis } from "lucide-react";

export function SessionDetailStatus({ isRisky }: { isRisky?: boolean }) {
  const bgStyle =
    "from-destructive to-destructive/60 text-white bg-linear-to-b";
  return (
    <div
      className={cn(
        "h-full bg-background p-5 col-start-1 col-end-3 rounded-md flex flex-col justify-between gap-4",
        isRisky && bgStyle,
      )}
    >
      <div className="flex justify-between items-center">
        <p className="font-bold">세션 상태</p>
      </div>
      <div className="flex-1 flex flex-col justify-between">
        <p className="text-6xl font-bold">확인 필요</p>
        <div className="flex gap-2 pt-3 px-3 items-center">
          <RectangleEllipsis className="size-3" />
          <p className="text-sm flex gap-2">
            즉시 연관된 이슈를 확인해야 합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
