import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback de carga para rutas lazy. En lugar de un spinner centrado,
 * dibuja un esqueleto que respeta la estructura típica de página
 * (header + grid de cards), reduciendo el "salto" visual al cargar.
 */
export default function RouteLoadingFallback() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header skeleton */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1 min-w-0">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32 shrink-0" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>

      {/* Content skeleton */}
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}
