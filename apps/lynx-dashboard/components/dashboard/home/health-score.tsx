import React from "react";
import { ListSkeleton } from "../shared/skeletons";

export function HealthScore() {
  return (
    <ListSkeleton className="h-full" rows={5} />
  );
}
