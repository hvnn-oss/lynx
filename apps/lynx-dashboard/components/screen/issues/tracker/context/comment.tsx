"use client";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import { Button, buttonVariants } from "@repo/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { SmilePlus } from "lucide-react";

export function IssueTrackerItemContextComment() {
  return (
    <>
      <div className="w-0.5 h-5 bg-foreground/25 ml-5"></div>
      <div className="bg-background rounded-md p-5">
        <div className="flex items-center font-bold gap-2">
          <Avatar size="sm">
            <AvatarImage
              className="bg-background"
              src="https://github.com/shadcn.png"
              alt={"item.id"}
            />
            <AvatarFallback>DL</AvatarFallback>
          </Avatar>
          <p>Dan Lee</p>
        </div>
        <div className="text-sm mt-5">
          <p>
            이거 좀 심각한 문제라고 생각합니다.
            <br />
            환불이라는 건 사용자의 돈과 직접적으로 연결된 부분이니
            <br />
            즉시 개선이 필요해 보이네요.
            <br />
            <br />제 생각엔 이번 프롬프트 버전(고객상담 v 1.23.0)에서
            <br />
            {"'"}고객 요청 시 왠만한 건 들어주는게 좋다{"'"}라고 추가한 부분에서
            문제가 되는 것 같네요
            <br />
            <br />
            {"'"}환불, 쿠폰 지급 등 돈과 관련된 문제는 상담사 연결을 유도하라
            {"'"}는
            <br /> 프롬프트를 추가하는 건 어떨까요?
          </p>
        </div>
        <div className="mt-3 flex gap-1">
          <Tooltip>
            <TooltipTrigger
              className={buttonVariants({
                variant: "outline",
                size: "icon-xs",
                className:
                  "aspect-square rounded-full flex items-center justify-center",
              })}
            >
              <SmilePlus className="size-4" />
            </TooltipTrigger>
            <TooltipContent>추가</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              className={buttonVariants({
                variant: "outline",
                size: "xs",
                className: "flex rounded-full",
              })}
            >
              <p>👍</p>
              <p>8</p>
            </TooltipTrigger>
            <TooltipContent className="flex flex-col items-center">
              <p>Hyunwoo Park</p>
              <p>Siyeon Jung</p>
              <p>Hanyong Kim</p>
              <p>... + 5</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </>
  );
}
