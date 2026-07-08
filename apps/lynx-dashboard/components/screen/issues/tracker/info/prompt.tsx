export function IssueTrackerItemPrompt() {
  return (
    <div>
      <p className="text-sm mb-2 text-foreground/50">사용된 프롬프트 버전</p>
      <div className="flex flex-wrap gap-1">
        <p className="text-sm border border-border px-2 rounded-full w-fit">
          v 1.23.0
        </p>
      </div>
    </div>
  );
}
