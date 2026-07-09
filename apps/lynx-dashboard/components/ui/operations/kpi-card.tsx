import { cn } from "@/lib/utils";

type KpiTone = "neutral" | "good" | "warning" | "bad";

export function OperationsKpiCard({
  label,
  value,
  description,
  tone = "neutral",
}: {
  label: string;
  value: string;
  description?: string;
  tone?: KpiTone;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-normal text-muted-foreground">
          {label}
        </p>
        <span className={cn("mt-0.5 size-2 rounded-sm", getToneDot(tone))} />
      </div>
      <p className={cn("mt-3 text-2xl font-bold tracking-normal", getToneText(tone))}>
        {value}
      </p>
      {description ? (
        <p className="mt-2 text-xs font-medium leading-5 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function getToneDot(tone: KpiTone) {
  if (tone === "good") return "bg-emerald-500";
  if (tone === "warning") return "bg-amber-500";
  if (tone === "bad") return "bg-rose-500";
  return "bg-slate-400";
}

function getToneText(tone: KpiTone) {
  if (tone === "good") return "text-emerald-700";
  if (tone === "warning") return "text-amber-700";
  if (tone === "bad") return "text-rose-700";
  return "text-foreground";
}
