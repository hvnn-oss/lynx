import React from "react";
import { CardSkeleton } from "../shared/skeletons";

export function SloStatus() {
  return (
    <CardSkeleton className="w-full" rows={3} />
  );
}
