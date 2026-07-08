import { IssueTrackerItemContext } from "./context";
import { IssueTrackerItemDefaultInfo } from "./info";

export function IssueTrackerItemScreen() {
  return (
    <div className="flex gap-10">
      <IssueTrackerItemContext />
      <IssueTrackerItemDefaultInfo />
    </div>
  );
}
