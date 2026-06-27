import React from "react";
import { ListSkeleton } from "../shared/skeletons";

export function CostAnomaly() {
  return (
    <ListSkeleton className="w-full" rows={3} />
  );
}
