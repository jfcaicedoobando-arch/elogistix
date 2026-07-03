/**
 * `<ListSkeleton />` — placeholder tabular/card mientras cargan listados.
 *
 * Elimina los bucles ad-hoc de `<Skeleton />` en Tesorería y otras páginas.
 */
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface ListSkeletonProps {
  /** Número de filas/cards a renderizar. Default: 5. */
  rows?: number;
  /** Presentación: filas tabulares u tarjetas. Default: "table". */
  variant?: "table" | "card";
  className?: string;
}

export function ListSkeleton({
  rows = 5,
  variant = "table",
  className,
}: ListSkeletonProps) {
  const items = Array.from({ length: Math.max(1, rows) });
  if (variant === "card") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Cargando"
        className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}
      >
        {items.map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Cargando"
      className={cn("space-y-2", className)}
    >
      {items.map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-md border bg-card px-3 py-2">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
