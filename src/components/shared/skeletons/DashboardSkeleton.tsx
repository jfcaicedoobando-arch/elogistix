/**
 * `<DashboardSkeleton />` — patrón "header + KPI grid + 2 charts" que
 * repetían `DireccionDashboard`, `PortalDashboard`, `Tesoreria`,
 * `Reportes`, etc. Ahora una sola pieza.
 */
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { KpiGridSkeleton } from "./KpiGridSkeleton";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  kpis?: number;
  chartHeightClass?: string;
  charts?: 1 | 2;
  /** Muestra header con título + acciones. Default `true`. */
  showHeader?: boolean;
}

export function DashboardSkeleton({
  className,
  kpis = 4,
  chartHeightClass = "h-64",
  charts = 2,
  showHeader = true,
}: Props) {
  return (
    <SkeletonGroup className={cn("space-y-6 animate-in fade-in duration-200", className)}>
      {showHeader && (
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-32 shrink-0" />
        </div>
      )}
      <KpiGridSkeleton count={kpis} />
      <div className={cn("grid gap-4", charts === 2 && "lg:grid-cols-2")}>
        {Array.from({ length: charts }).map((_, i) => (
          <Skeleton key={i} className={cn("w-full rounded-xl", chartHeightClass)} />
        ))}
      </div>
    </SkeletonGroup>
  );
}
