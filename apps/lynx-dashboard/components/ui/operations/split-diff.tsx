export function OperationsSplitDiff({
  before,
  after,
  beforeLabel,
  afterLabel,
}: {
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
}) {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");

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
          {beforeLines.length + afterLines.length} lines
        </p>
      </div>
      <div className="grid md:grid-cols-2">
        <DiffPane label={beforeLabel} lines={beforeLines} mode="delete" />
        <DiffPane label={afterLabel} lines={afterLines} mode="add" />
      </div>
    </div>
  );
}

function DiffPane({
  label,
  lines,
  mode,
}: {
  label: string;
  lines: string[];
  mode: "add" | "delete";
}) {
  return (
    <div className="min-w-0 border-border/70 md:border-r last:md:border-r-0">
      <div className="border-b border-border/60 bg-muted/20 px-3 py-2">
        <p className="text-xs font-bold text-muted-foreground">{label}</p>
      </div>
      <div className="max-h-[520px] overflow-auto font-mono text-xs">
        {lines.map((line, index) => (
          <div
            className={mode === "add" ? "flex bg-emerald-50" : "flex bg-rose-50"}
            key={`${mode}-${index}-${line}`}
          >
            <span className="w-10 shrink-0 select-none border-r border-black/5 px-2 py-1 text-right text-muted-foreground">
              {index + 1}
            </span>
            <span
              className={
                mode === "add"
                  ? "w-7 shrink-0 px-2 py-1 font-bold text-emerald-700"
                  : "w-7 shrink-0 px-2 py-1 font-bold text-rose-700"
              }
            >
              {mode === "add" ? "+" : "-"}
            </span>
            <pre className="min-w-0 flex-1 whitespace-pre-wrap px-2 py-1 leading-5 text-foreground">
              {line}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
