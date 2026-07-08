import { IssueTrackerItemContextComment } from "./comment";
import { IssueTrackerItemContextInput } from "./input";
import { IssueTrackerItemOverview } from "./overview";

export function IssueTrackerItemContext() {
  return (
    <div className="flex-1">
      <IssueTrackerItemOverview />
      <IssueTrackerItemContextComment />
      {/* <div className="w-0.5 h-5 bg-foreground/25 ml-5"></div> */}
      <IssueTrackerItemContextInput />
    </div>
  );
}
