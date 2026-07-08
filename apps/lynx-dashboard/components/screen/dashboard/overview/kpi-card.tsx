import { cn } from "@/lib/utils";
import { buttonVariants } from "@repo/ui/components/ui/button";
import { ArrowUpRight, RectangleEllipsis, Triangle } from "lucide-react";
import Link from "next/link";

export function KpiCard({
  title,
  subtitle,
  figure,
  unit,
  isRisky,
  href,
  ticker,
  tickerUp,
  tickerColorReverse,
}: {
  title: string;
  subtitle: string;
  figure: number;
  unit?: string;
  isRisky?: boolean;
  href?: string;
  ticker?: string;
  tickerUp?: boolean;
  tickerColorReverse?: boolean;
}) {
  const bgStyle =
    "from-destructive to-destructive/60 text-white bg-linear-to-b";
  const buttonStyle = "bg-white text-black border-transparent";
  const tickerClass =
    tickerUp !== (tickerColorReverse ?? false)
      ? "text-red-500"
      : "text-indigo-500";

  return (
    <div
      className={cn(
        "h-full bg-background p-5 rounded-md flex flex-col justify-between gap-4",
        isRisky && bgStyle,
      )}
    >
      <div className="flex justify-between items-center">
        <p className="font-bold">{title}</p>
        {href && (
          <Link
            className={cn(
              buttonVariants({
                variant: "outline",
              }),
              "size-8 aspect-square rounded-full",
              isRisky ? buttonStyle : "border border-border",
            )}
            href={href}
          >
            <ArrowUpRight className="size-5" strokeWidth={1} />
          </Link>
        )}
      </div>
      <div className="flex-1 flex flex-col justify-between">
        <p className="text-6xl font-bold">
          {figure}
          <span className="text-base">{unit}</span>
        </p>
        <div className="flex gap-2 pt-3 px-3 items-center">
          <RectangleEllipsis className="size-3" />
          <p className="text-sm flex gap-2">
            {subtitle}{" "}
            {ticker && (
              <span className={cn("flex items-center gap-1", tickerClass)}>
                {tickerUp ? (
                  <Triangle className="size-2 fill-current" />
                ) : (
                  <Triangle className="size-2 fill-current rotate-180" />
                )}
                {ticker}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
