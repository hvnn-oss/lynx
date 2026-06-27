import React from "react";
import { ListSkeleton } from "../shared/skeletons";

export function ModelUsage() {
  return (
    <ListSkeleton className="h-full" rows={4} />
  );
}
