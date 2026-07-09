/**
 * `<KpiGridSkeleton />` — rejilla estándar de KPIs para dashboards.
 *
 * Uso: `<KpiGridSkeleton count={4} />`. Los anchos por columna vienen del
 * `grid` responsive, la altura de la card se controla con `heightClass`.
 */
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Props {
  count?: number;
  /** Alto de cada card. Default `h-24`. */
  heightClass?: string;
  /** Columnas en mobile. Default 2. */
  mobileCols?: 1 | 2 | 3;
  /** Columnas desde `md`. Default 4. */
  desktopCols?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

const MOBILE_COLS: Record<1 | 2 | 3, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};
const DESKTOP_COLS: Record<2 | 3 | 4 | 5 | 6, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
  6: "md:grid-cols-6",
};

export function KpiGridSkeleton({
  count = 4,
  heightClass = "h-24",
  mobileCols = 2,
  desktopCols = 4,
  className,
}: Props) {
  return (
    <SkeletonGroup className={cn("grid gap-4", MOBILE_COLS[mobileCols], DESKTOP_COLS[desktopCols], className)}>
      {Array.from({ length: Math.max(1, count) }).map((_, i) => (
        <Skeleton key={i} className={cn("rounded-lg", heightClass)} />
      ))}
    </SkeletonGroup>
  );
}
