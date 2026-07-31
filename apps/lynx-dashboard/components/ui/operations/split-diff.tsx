import {
  buildPromptSplitDiffRows,
  countPromptDiffLines,
  type PromptDiffChange,
  type PromptDiffSide,
} from "@/lib/prompt-diff";

export function OperationsSplitDiff({
  changes,
  beforeLabel,
  afterLabel,
}: {
  changes: readonly PromptDiffChange[];
  beforeLabel: string;
  afterLabel: string;
}) {
  const rows = buildPromptSplitDiffRows(changes);
  const lineCounts = countPromptDiffLines(changes);

  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-background">
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/30 px-4 py-2">
        <div>
          <p className="text-sm font-bold">prompt.md</p>
          <p className="text-xs text-muted-foreground">
            {beforeLabel} -&gt; {afterLabel}
          </p>
        </div>
        <p className="text-xs font-bold text-muted-foreground">
          {lineCounts.before} -&gt; {lineCounts.after} lines
        </p>
      </div>

      <div className="max-h-[520px] overflow-auto">
        <div className="min-w-[720px]">
          <div className="sticky top-0 z-10 grid grid-cols-2 border-b border-border/60 bg-muted/20">
            <DiffPaneHeader label={beforeLabel} />
            <DiffPaneHeader label={afterLabel} />
          </div>

          {rows.map((row, index) => (
            <div
              className="grid min-h-7 grid-cols-2"
              key={`${index}-${row.before?.lineNumber ?? "empty"}-${row.after?.lineNumber ?? "empty"}`}
            >
              <DiffLine side={row.before} pane="before" />
              <DiffLine side={row.after} pane="after" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DiffPaneHeader({ label }: { label: string }) {
  return (
    <div className="border-r border-border/60 px-3 py-2 last:border-r-0">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
    </div>
  );
}

function DiffLine({
  side,
  pane,
}: {
  side: PromptDiffSide | null;
  pane: "before" | "after";
}) {
  const isRemoved = side?.type === "REMOVED";
  const isAdded = side?.type === "ADDED";
  const background = !side
    ? "bg-muted/20"
    : isRemoved
      ? "bg-rose-50 dark:bg-rose-950/25"
      : isAdded
        ? "bg-emerald-50 dark:bg-emerald-950/25"
        : "bg-background";
  const marker = isRemoved ? "-" : isAdded ? "+" : "";
  const markerColor = isRemoved
    ? "text-rose-700 dark:text-rose-300"
    : isAdded
      ? "text-emerald-700 dark:text-emerald-300"
      : "text-muted-foreground";

  return (
    <div
      className={`flex min-w-0 border-r border-b border-border/40 last:border-r-0 ${background}`}
      data-pane={pane}
      data-change-type={side?.type ?? "EMPTY"}
    >
      <span className="w-10 shrink-0 select-none border-r border-black/5 px-2 py-1 text-right text-muted-foreground">
        {side?.lineNumber ?? ""}
      </span>
      <span
        className={`w-7 shrink-0 px-2 py-1 font-bold ${markerColor}`}
        aria-hidden="true"
      >
        {marker}
      </span>
      <pre className="min-w-0 flex-1 whitespace-pre-wrap px-2 py-1 font-mono text-xs leading-5 text-foreground">
        {side?.line ?? ""}
      </pre>
    </div>
  );
}
