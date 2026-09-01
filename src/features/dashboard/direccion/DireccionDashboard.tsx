/**
 * Dashboard Dirección — vista ejecutiva para dueño/gerencia.
 * KPIs: utilidad, cartera, meta, tendencia y riesgo (MXN).
 */
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardSkeleton } from "@/components/shared/skeletons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useDireccionKpis } from "@/features/dashboard/direccion/hooks/useDireccionKpis";
import { useDireccionTotales } from "@/features/dashboard/direccion/hooks/useDireccionTotales";
import { HeroCards } from "@/features/dashboard/direccion/components/HeroCards";
import { TotalesPeriodoCard } from "@/features/dashboard/direccion/components/TotalesPeriodoCard";
import { RentabilidadSection } from "@/features/dashboard/direccion/components/RentabilidadSection";
import { CarteraSection } from "@/features/dashboard/direccion/components/CarteraSection";
import { PulsoSection } from "@/features/dashboard/direccion/components/PulsoSection";
import { TipoCambioFallbackBanner } from "@/features/dashboard/direccion/components/TipoCambioFallbackBanner";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { useDocumentTitle } from "@/hooks/shared";

export default function DireccionDashboard() {
  useDocumentTitle("Panel");
  const { data, isLoading, error, refetch } = useDireccionKpis();
  const { data: totales, isLoading: totalesLoading, desdeIso } = useDireccionTotales();

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard de dirección"
        description="¿Ganamos dinero, quién nos debe, y vamos según meta?"
      />

      <TipoCambioFallbackBanner />

      {/* Máquina de estados mutuamente excluyente: loading → error → data.
          En error no se ve skeleton ni contenido viejo como si fuera actual. */}
      {isLoading ? (
        <DashboardSkeleton kpis={3} showHeader={false} />
      ) : error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No se pudieron cargar los KPIs</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{(error as Error).message}</p>
            <Button variant="outline" size="sm" onClick={() => { void refetch(); }}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : !data ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Sin información</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>Todavía no hay datos suficientes para calcular los KPIs.</p>
            <Button variant="outline" size="sm" onClick={() => { void refetch(); }}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <HeroCards hero={data.hero} />
          <TotalesPeriodoCard totales={totales} desdeIso={desdeIso} isLoading={totalesLoading} />

          <section className="space-y-2">
            <SectionHeading variant="overline">Rentabilidad</SectionHeading>
            <RentabilidadSection margen6m={data.margen_6m} porModo={data.margen_por_modo} />
          </section>
          <section className="space-y-2">
            <SectionHeading variant="overline">Riesgo y cartera</SectionHeading>
            <CarteraSection antiguedad={data.antiguedad} topClientes={data.top_clientes} />
          </section>
          <section className="space-y-2">
            <SectionHeading variant="overline">Pulso del negocio</SectionHeading>
            <PulsoSection pulso={data.pulso} />
          </section>
        </>
      )}
    </PageContainer>
  );
}
