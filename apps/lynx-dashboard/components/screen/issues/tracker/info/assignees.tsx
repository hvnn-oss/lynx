"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";

const mockupData = [
  {
    avatar: {
      src: "https://github.com/shadcn.png",
      fallback: "DL",
    },
    name: "Dan Lee",
    id: "73fe548f-4b29-4be7-9a3e-4bdbd6c22906",
  },
  {
    avatar: {
      src: "https://cdn.discordapp.com/avatars/1067115614566633624/2386b88d8ab90de5ed96a720a4a5e41d.webp?size=80",
      fallback: "HW",
    },
    name: "Hyunwoo Park",
    id: "0c0a5766-cac2-4936-ac02-4f1d64ac9f6a",
  },
  {
    avatar: {
      src: "https://cdn.discordapp.com/avatars/453605275983937547/2c2d21e1a98a5bfac91a866991a85d23.webp?size=32",
      fallback: "SJ",
    },
    name: "Siyeon Jung",
    id: "69b2640a-6674-49f8-aa3c-cc0024610567",
  },
];

export function IssueTrackerItemInfoAssignees() {
  return (
    <div>
      <p className="text-sm mb-2 text-foreground/50">담당자</p>
      <AvatarGroup>
        {mockupData.map((item) => (
          <Tooltip key={item.id}>
            <TooltipTrigger>
              <Avatar>
                <AvatarImage
                  className="bg-background"
                  src={item.avatar.src}
                  alt={item.id}
                />
                <AvatarFallback>{item.avatar.fallback}</AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>{item.name}</TooltipContent>
          </Tooltip>
        ))}
      </AvatarGroup>
    </div>
  );
}
