import React from "react";
import { ListSkeleton } from "../shared/skeletons";

export function RecentIssues() {
  return (
    <ListSkeleton className="w-full" rows={4} />
  );
}
