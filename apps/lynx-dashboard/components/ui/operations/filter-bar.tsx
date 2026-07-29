import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";

export function OperationsFilterBar({
  searchPlaceholder,
  filters,
}: {
  searchPlaceholder: string;
  filters: { label: string; options: string[] }[];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background p-3 md:flex-row md:items-center">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-foreground/30"
          placeholder={searchPlaceholder}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Select defaultValue={filter.options[0]} key={filter.label}>
            <SelectTrigger aria-label={filter.label} className="h-9 min-w-32">
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent>
              {filter.options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>
    </div>
  );
}
