import React from "react";
import { ListSkeleton } from "../shared/skeletons";

export function ErrorRateDistribution() {
  return (
    <ListSkeleton className="h-full" rows={3} />
  );
}
