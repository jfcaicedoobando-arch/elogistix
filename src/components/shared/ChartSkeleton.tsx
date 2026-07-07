/**
 * Skeleton estándar para fallback de `<Suspense>` mientras carga el chunk
 * `charts-vendor` (recharts). Mantiene altura idéntica al chart real y
 * dibuja pseudo-ejes + barras variables para reducir CLS al montar recharts.
 */
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Props {
  /** Altura en píxeles. Debe coincidir con la del chart final. */
  height?: number;
  className?: string;
  /** Muestra ejes + barras. Si `false`, pinta un rectángulo (legacy). */
  detailed?: boolean;
}

const BAR_HEIGHTS = ["h-1/3", "h-1/2", "h-2/3", "h-3/4", "h-2/5", "h-4/5", "h-3/5"];

export function ChartSkeleton({ height = 300, className, detailed = true }: Props) {
  // C10: height inline porque debe igualar exactamente al chart real (px dinámico).
  const style = { height: `${height}px` };

  if (!detailed) {
    return (
      <SkeletonGroup className={cn("w-full", className)}>
        <Skeleton className="w-full h-full" style={style} />
      </SkeletonGroup>
    );
  }

  return (
    <SkeletonGroup
      className={cn("w-full rounded-lg border bg-card p-4", className)}
      style={style}
    >
      <div className="flex h-full gap-3">
        {/* Eje Y */}
        <div className="flex flex-col justify-between py-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-2 w-8 opacity-60" />
          ))}
        </div>
        {/* Área del chart */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-end gap-2">
            {BAR_HEIGHTS.map((h, i) => (
              <Skeleton key={i} className={cn("flex-1 rounded-sm", h)} />
            ))}
          </div>
          {/* Eje X */}
          <div className="mt-2 flex justify-between">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-2 w-6 opacity-60" />
            ))}
          </div>
        </div>
      </div>
    </SkeletonGroup>
  );
}
