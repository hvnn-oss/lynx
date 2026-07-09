import type { IssueEvent } from "@/lib/operations/types";
import { formatDateTime } from "./format";

export function OperationsEventTimeline({ events }: { events: IssueEvent[] }) {
  return (
    <div className="border-l border-border/70 pl-5">
      {events.map((event) => (
        <details
          className="relative mb-4 rounded-lg border border-border/60 p-4 open:bg-muted/20"
          key={event.id}
          open={event.policyResult?.includes("BLOCK")}
        >
          <span className="absolute -left-[25px] top-5 size-2.5 rounded-sm bg-foreground" />
          <summary className="cursor-pointer list-none">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">{event.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{event.summary}</p>
              </div>
              <p className="text-xs text-muted-foreground">{formatDateTime(event.timestamp)}</p>
            </div>
          </summary>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <Payload label="input" value={event.input} />
            <Payload label="output" value={event.output} />
            <Payload label="payload" value={event.payload} />
            <Payload label="policy result" value={event.policyResult} />
            <Payload label="span" value={`${event.parentSpanId ?? "-"} / ${event.spanId}`} />
          </div>
        </details>
      ))}
    </div>
  );
}

function Payload({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-md border border-border/60 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs">{value ?? "-"}</pre>
    </div>
  );
}
