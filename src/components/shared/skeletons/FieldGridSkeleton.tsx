/**
 * `<FieldGridSkeleton />` — grid de campos label + value.
 * Para reemplazar los `<Skeleton className="h-24 w-full" />` planos
 * dentro de `FacturaReceptorCard`, `FacturaEmisorCard`, etc.
 *
 * Cada campo dibuja una etiqueta corta arriba y un valor largo abajo,
 * imitando la forma real del contenido final para eliminar CLS.
 */
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  fields?: number;
  cols?: 2 | 3 | 4;
}

const COLS: Record<2 | 3 | 4, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
};

export function FieldGridSkeleton({ className, fields = 6, cols = 3 }: Props) {
  const widths = ["w-2/3", "w-3/4", "w-1/2", "w-4/5", "w-3/5", "w-5/6"];
  return (
    <SkeletonGroup className={cn("grid gap-4", COLS[cols], className)}>
      {Array.from({ length: Math.max(1, fields) }).map((_, i) => (
        <div key={i} className="space-y-1.5 min-w-0">
          <Skeleton className="h-3 w-16" />
          <Skeleton className={cn("h-4", widths[i % widths.length])} />
        </div>
      ))}
    </SkeletonGroup>
  );
}
