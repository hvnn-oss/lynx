import React from "react";
import { ListSkeleton } from "../shared/skeletons";

export function RecentOutages() {
  return (
    <ListSkeleton className="w-full" rows={3} />
  );
}
