import { SessionDetailTimelineItem } from "./item/timeline-item";

export function SessionDetailTimeline() {
  return (
    <div className="bg-background p-5 rounded-md mt-2">
      <div className="flex h-fit items-stretch px-10 py-5">
        <div className="w-px bg-border shrink-0"></div>
        <div className="flex flex-col gap-5 w-full">
          <SessionDetailTimelineItem />
          <SessionDetailTimelineItem />
          <SessionDetailTimelineItem />
          <SessionDetailTimelineItem />
        </div>
      </div>
    </div>
  );
}
