/**
 * Skeleton estándar para fallback de `<Suspense>` mientras carga el chunk
 * `charts-vendor` (recharts). Mantener altura idéntica al chart real para
 * evitar CLS.
 */
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  /** Altura en píxeles. Debe coincidir con la del chart final. */
  height?: number;
  className?: string;
}

export function ChartSkeleton({ height = 300, className }: Props) {
  // C10: width usa Tailwind (`w-full`); height permanece inline porque es un valor dinámico (px exacto) que debe igualar al chart real para evitar CLS.
  return <Skeleton className={`w-full ${className ?? ""}`} style={{ height: `${height}px` }} />;
}
