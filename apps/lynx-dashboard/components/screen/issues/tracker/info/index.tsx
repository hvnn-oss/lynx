"use client";
import { IssueTrackerItemInfoAssignees } from "./assignees";
import { IssueTrackerItemDangerLevel } from "./danger-level";
import { IssueTrackerItemDate } from "./date";
import { IssueTrackerItemInfoLabel } from "./label";
import { IssueTrackerItemManager } from "./manager";
import { IssueTrackerItemModel } from "./model";
import { IssueTrackerItemPrompt } from "./prompt";

export function IssueTrackerItemDefaultInfo() {
  return (
    <div className="w-60">
      <IssueTrackerItemManager />
      <div className="w-full h-px bg-border my-3"></div>
      <IssueTrackerItemInfoAssignees />
      <div className="w-full h-px bg-border my-3"></div>
      <IssueTrackerItemInfoLabel />
      <div className="w-full h-px bg-border my-3"></div>
      <IssueTrackerItemDangerLevel />
      <div className="w-full h-px bg-border my-3"></div>
      <IssueTrackerItemDate />
      <div className="w-full h-px bg-border my-3"></div>
      <IssueTrackerItemModel />
      <div className="w-full h-px bg-border my-3"></div>
      <IssueTrackerItemPrompt />
    </div>
  );
}
