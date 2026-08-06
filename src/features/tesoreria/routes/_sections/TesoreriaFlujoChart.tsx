/**
 * Curva de flujo proyectado embebida en el dashboard de Tesorería (12 semanas)
 * con enlace a la vista completa de 90 días.
 */
import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { ChartSkeleton } from "@/components/shared/ChartSkeleton";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { getErrorMessage } from "@/lib/errors";
import { useFlujoProyectado } from "@/features/tesoreria/hooks";
import { ROUTES } from "@/constants/routes";

const GraficoFlujoProyectado = lazy(
  () => import("@/features/tesoreria/components/GraficoFlujoProyectado"),
);

export function TesoreriaFlujoChart() {
  const { data, isLoading, error, refetch } = useFlujoProyectado(90);

  return (
    <Card>
      <CardContent density="compact">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionHeading as="h3">Flujo de caja proyectado</SectionHeading>
          <Link
            to={ROUTES.TESORERIA_FLUJO}
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            Ver 90 días <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {error ? (
          <ErrorStateInline message={getErrorMessage(error)} onRetry={() => refetch()} />
        ) : isLoading || !data ? (
          <ChartSkeleton />
        ) : (
          <Suspense fallback={<ChartSkeleton />}>
            <GraficoFlujoProyectado semanas={data.semanas} />
          </Suspense>
        )}
      </CardContent>
    </Card>
  );
}
