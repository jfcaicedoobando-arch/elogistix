import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox } from "lucide-react";
import { ALIGN_CLASS, type DataTableColumn } from "@/components/shared/dataTable/types";

export function VirtualHeaderRow<T>({ columns, gridTemplate }: { columns: DataTableColumn<T>[]; gridTemplate: string }) {
  return (
    <div
      className="sticky top-0 z-10 grid bg-muted/60 backdrop-blur-sm text-xs font-medium text-muted-foreground border-b"
      style={{ gridTemplateColumns: gridTemplate }}
      role="row"
    >
      {columns.map((c) => (
        <div
          key={c.key}
          className={cn("px-3 py-2 truncate", ALIGN_CLASS[c.align ?? "left"], c.headerClassName)}
          role="columnheader"
        >
          {c.header}
        </div>
      ))}
    </div>
  );
}

export function SkeletonRows<T>({ count, columns, gridTemplate, cellPad }: { count: number; columns: DataTableColumn<T>[]; gridTemplate: string; cellPad: string }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={`sk-${i}`} className="grid border-b" style={{ gridTemplateColumns: gridTemplate }}>
          {columns.map((c) => (
            <div key={c.key} className={cn("px-3", cellPad)}>
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
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
