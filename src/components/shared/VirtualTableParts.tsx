import { cn } from "@/lib/utils";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { Inbox } from "lucide-react";
import { flexRender, type Table } from "@tanstack/react-table";
import { ALIGN_CLASS, type ColumnAlign } from "@/components/shared/dataTable/types";
import "@/components/shared/dataTable/columnMeta";

export function VirtualHeaderRow<T>({ table, gridTemplate }: { table: Table<T>; gridTemplate: string }) {
  return (
    <div
      className="sticky top-0 z-10 grid bg-muted/60 backdrop-blur-sm text-xs font-medium text-muted-foreground border-b"
      style={{ gridTemplateColumns: gridTemplate }}
      role="row"
    >
      {table.getHeaderGroups().map((hg) =>
        hg.headers.map((header) => {
          const meta = header.column.columnDef.meta ?? {};
          const align: ColumnAlign = meta.align ?? "left";
          return (
            <div
              key={header.id}
              className={cn("px-3 py-2 truncate", ALIGN_CLASS[align], meta.headerClassName)}
              role="columnheader"
            >
              {flexRender(header.column.columnDef.header, header.getContext())}
            </div>
          );
        }),
      )}
    </div>
  );
}

export function SkeletonRows<T>({ count, table, gridTemplate, cellPad }: { count: number; table: Table<T>; gridTemplate: string; cellPad: string }) {
  const cols = table.getAllLeafColumns();
  // Anchos variables por columna+fila para que no parezca una rejilla rígida
  // (mismo criterio que `DataTableBody`).
  const barWidths = ["w-3/5", "w-4/5", "w-2/3", "w-3/4", "w-1/2", "w-5/6"];
  return (
    <SkeletonGroup>
      {Array.from({ length: count }).map((_, i) => (
        <div key={`sk-${i}`} className="grid border-b" style={{ gridTemplateColumns: gridTemplate }}>
          {cols.map((c, colIdx) => {
            const meta = c.columnDef.meta ?? {};
            const align: ColumnAlign = meta.align ?? "left";
            const wrapJustify =
              align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
            const barW = barWidths[(i + colIdx) % barWidths.length];
            return (
              <div key={c.id} className={cn("px-3 flex items-center", cellPad, wrapJustify)}>
                <Skeleton className={cn("h-4", barW)} />
              </div>
            );
          })}
        </div>
      ))}
    </SkeletonGroup>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <Inbox className="h-8 w-8 opacity-40" strokeWidth={1.5} />
      <span>{message}</span>
    </div>
  );
}
