/**
 * Dashboard Dirección — vista ejecutiva para dueño/gerencia.
 * KPIs: utilidad, cartera, meta, tendencia y riesgo (MXN).
 */
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardSkeleton } from "@/components/shared/skeletons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useDireccionKpis } from "@/features/dashboard/direccion/hooks/useDireccionKpis";
import { useDireccionTotales } from "@/features/dashboard/direccion/hooks/useDireccionTotales";
import { HeroCards } from "@/features/dashboard/direccion/components/HeroCards";
import { TotalesPeriodoCard } from "@/features/dashboard/direccion/components/TotalesPeriodoCard";
import { RentabilidadSection } from "@/features/dashboard/direccion/components/RentabilidadSection";
import { CarteraSection } from "@/features/dashboard/direccion/components/CarteraSection";
import { PulsoSection } from "@/features/dashboard/direccion/components/PulsoSection";
import { TipoCambioFallbackBanner } from "@/features/dashboard/direccion/components/TipoCambioFallbackBanner";

export default function DireccionDashboard() {
  const { data, isLoading, error } = useDireccionKpis();

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard Dirección"
        description="¿Ganamos dinero, quién nos debe, y vamos según meta?"
      />

      <TipoCambioFallbackBanner />

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No se pudieron cargar los KPIs</AlertTitle>
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {isLoading || !data ? (
        <DashboardSkeleton kpis={3} showHeader={false} />
      ) : (
        <>
          <HeroCards hero={data.hero} />
          <section className="space-y-2">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Rentabilidad</h2>
            <RentabilidadSection margen6m={data.margen_6m} porModo={data.margen_por_modo} />
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Riesgo y cartera</h2>
            <CarteraSection antiguedad={data.antiguedad} topClientes={data.top_clientes} />
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Pulso del negocio</h2>
            <PulsoSection pulso={data.pulso} />
          </section>
        </>
      )}
    </PageContainer>
  );
}
