import React from "react";
import { ListSkeleton } from "../shared/skeletons";

export function AgentComparison() {
  return (
    <ListSkeleton className="w-full" rows={5} />
  );
}
