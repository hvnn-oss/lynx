import React from "react";
import { CardSkeleton } from "../shared/skeletons";
import AccumulatedAgentUsage from "./kpi/accumulated-agent-usage";

export function KpiCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
      <AccumulatedAgentUsage />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
