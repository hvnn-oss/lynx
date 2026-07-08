export function IssueTrackerItemDangerLevel() {
  return (
    <div>
      <p className="text-sm mb-2 text-foreground/50">위험 수준</p>
      <div className="text-sm flex gap-1 text-destructive border border-destructive w-fit rounded-full px-2 select-none">
        <p>즉시 조치 필요</p>
      </div>
    </div>
  );
}
