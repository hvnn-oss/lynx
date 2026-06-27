import React from "react";
import { ListSkeleton } from "../shared/skeletons";

export function ModelStatus() {
  return (
    <ListSkeleton className="h-full" rows={4} />
  );
}
