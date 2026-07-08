import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";

export function IssueTrackerItemManager() {
  return (
    <div>
      <p className="text-sm mb-2 text-foreground/50">책임자</p>
      <div className="flex gap-2 items-center">
        <Avatar>
          <AvatarImage
            className="bg-background"
            src="https://github.com/shadcn.png"
            alt={"item.id"}
          />
          <AvatarFallback>DL</AvatarFallback>
        </Avatar>
        <p className="font-bold">Dan Lee</p>
      </div>
    </div>
  );
}
