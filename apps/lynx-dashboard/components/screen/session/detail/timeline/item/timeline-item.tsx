"use client";
import { TextCursorInput } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function SessionDetailTimelineItem() {
  const [iconWidth, setIconWidth] = useState(0);
  const iconRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!iconRef.current) return;
    const w = iconRef.current.offsetWidth;
    setIconWidth(w);
  }, [iconRef, iconWidth]);

  return (
    <div
      className="flex gap-5 items-center relative z-10 w-full"
      style={{
        left: `-${Math.floor(iconWidth / 2)}px`,
      }}
    >
      <div
        className="p-1 aspect-square h-fit bg-background border rounded-full"
        ref={iconRef}
      >
        <TextCursorInput />
      </div>
      <button className="p-3 rounded-md border border-background hover:border-border transition-colors duration-300 w-full cursor-pointer text-start">
        <div className="flex gap-2">
          <p className="bg-accent border w-fit text-sm font-bold px-1 flex items-center rounded-sm">
            #1
          </p>
          <p className="font-bold">사용자 입력</p>
        </div>
        <div className="mt-2 text-sm text-foreground/80">
          <p>user.input</p>
        </div>
        <div>
          {/* <div className="bg-destructive text-destructive-foreground font-bold w-fit p-1 text-xs rounded-md mt-3">
            런타임 에러
          </div> */}
        </div>
      </button>
    </div>
  );
}
