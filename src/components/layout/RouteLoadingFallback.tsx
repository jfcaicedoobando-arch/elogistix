import { PageSkeleton } from "@/components/shared/skeletons";

/**
 * Fallback de carga para rutas lazy. Se mantiene neutro (header + bloque)
 * para no forzar el "flash" de un dashboard KPI en rutas de detalle o
 * portal. Rutas específicas pueden envolver su propio `<Suspense>` con
 * `DashboardSkeleton` / `DetailSkeleton`.
 */
export default function RouteLoadingFallback() {
  return <PageSkeleton />;
}
