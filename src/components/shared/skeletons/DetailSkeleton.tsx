/**
 * `<DetailSkeleton />` — para páginas `/*/:id` (factura, embarque, cotización).
 * Header + fila de metadatos + 2 columnas de cards.
 */
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  /** Número de cards de contenido. Default 2. */
  sections?: number;
}

export function DetailSkeleton({ className, sections = 2 }: Props) {
  return (
    <SkeletonGroup className={cn("space-y-6 animate-in fade-in duration-200", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1 min-w-0">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex gap-2 shrink-0">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: sections }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-xl" />
        ))}
      </div>
    </SkeletonGroup>
  );
}
