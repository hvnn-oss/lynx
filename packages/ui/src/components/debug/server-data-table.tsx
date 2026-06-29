"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

export interface ServerDataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  emptyText: string;
  isLoading?: boolean;
  loadingText?: string;
  hasNextPage?: boolean;
  canGoBack?: boolean;
  onNextPage?: () => void;
  onPreviousPage?: () => void;
  footer?: ReactNode;
  className?: string;
}

export function ServerDataTable<TData>({
  columns,
  data,
  emptyText,
  isLoading,
  loadingText = "Loading...",
  hasNextPage,
  canGoBack,
  onNextPage,
  onPreviousPage,
  footer,
  className,
}: ServerDataTableProps<TData>) {
  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  });

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border/60 bg-background",
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="h-10 px-3 text-left font-medium"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  className="h-28 px-3 text-center text-muted-foreground"
                  colSpan={columns.length}
                >
                  {loadingText}
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  className="h-28 px-3 text-center text-muted-foreground"
                  colSpan={columns.length}
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-border/40 transition-colors hover:bg-muted/20"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-3 align-top">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border/40 px-3 py-2">
        <div className="min-w-0 text-xs text-muted-foreground">{footer}</div>
        <div className="flex items-center gap-1">
          <Button
            aria-label="Previous page"
            disabled={!canGoBack || isLoading}
            size="icon-sm"
            type="button"
            variant="ghost"
            onClick={onPreviousPage}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            aria-label="Next page"
            disabled={!hasNextPage || isLoading}
            size="icon-sm"
            type="button"
            variant="ghost"
            onClick={onNextPage}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
