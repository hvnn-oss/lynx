"use client";

import { useState } from "react";
import { CardSkeleton } from "../../shared/skeletons";

export default function AccumulatedAgentUsage() {
  const [isLoading, setLoading] = useState(true);

  if (isLoading) return <CardSkeleton />;

  return (
    <div className="bg-card/30 border border-border/40 rounded-xl p-6"></div>
  );
}
