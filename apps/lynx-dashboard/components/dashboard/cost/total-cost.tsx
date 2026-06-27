import React from "react";
import { CardSkeleton } from "../shared/skeletons";

export function TotalCost() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
