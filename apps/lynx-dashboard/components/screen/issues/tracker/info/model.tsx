export function IssueTrackerItemModel() {
  return (
    <div>
      <p className="text-sm mb-2 text-foreground/50">사용된 모델</p>
      <div className="flex flex-wrap gap-1">
        <p className="text-sm border border-border px-2 rounded-full w-fit">
          GPT 5.5 High
        </p>
        <p className="text-sm border border-border px-2 rounded-full w-fit">
          Calude Mythos
        </p>
        <p className="text-sm border border-border px-2 rounded-full w-fit">
          Gemini 3.1 Flash
        </p>
        <p className="text-sm border border-border px-2 rounded-full w-fit">
          Gemini 3.1 Pro
        </p>
      </div>
    </div>
  );
}
