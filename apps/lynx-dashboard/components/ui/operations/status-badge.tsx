import { cn } from "@/lib/utils";
import type { IssueSeverity } from "@/lib/operations/types";

export function OperationsBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function getSeverityClass(severity: IssueSeverity) {
  if (severity === "critical") return "border-rose-200 bg-rose-50 text-rose-700";
  if (severity === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function getStateClass(state: string) {
  if (state === "open" || state === "block" || state === "blocked") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (state === "investigating" || state === "warn" || state === "staged") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (state === "resolved" || state === "production") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}
