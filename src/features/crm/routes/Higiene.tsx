/**
 * /crm/higiene — Tablero de higiene del pipeline (Etapa 2 CRM Hunter).
 * Replica el tablero "06_Higiene" del Excel comercial: SLA por etapa,
 * días sin movimiento, completitud del registro y cobertura vs presupuesto.
 */
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { LoadingState } from "@/components/shared/states/LoadingState";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { useDocumentTitle } from "@/hooks/shared";
import HigieneKpis from "@/features/crm/components/higiene/HigieneKpis";
import HigieneTabla from "@/features/crm/components/higiene/HigieneTabla";
import {
  useHigieneResumen, useHigieneOportunidades, usePresupuestoCrm,
} from "@/features/crm/hooks/useHigienePipeline";
import { coberturaPonderada, presupuestoDelMes } from "@/features/crm/domain/higieneMetas";
import { ymMx } from "@/lib/date/mx";

export default function CrmHigiene() {
  useDocumentTitle("Higiene del pipeline");
  // Año/mes de negocio CDMX: `getFullYear()/getMonth()` locales podían
  // cambiar de mes cerca de medianoche para usuarios en otros husos.
  const [anioMx, mesMx] = ymMx().split("-").map(Number);
  const resumenQ = useHigieneResumen();
  const filasQ = useHigieneOportunidades();
  const presupuestoQ = usePresupuestoCrm(anioMx);

  if (resumenQ.isLoading || filasQ.isLoading) {
    return <LoadingState label="Calculando higiene del pipeline…" />;
  }

  if (resumenQ.isError || filasQ.isError || presupuestoQ.isError) {
    return (
      <PageContainer>
        <ErrorState
          title="No se pudo calcular la higiene"
          description="Vuelve a intentarlo en unos momentos."
          onRetry={() => { void resumenQ.refetch(); void filasQ.refetch(); void presupuestoQ.refetch(); }}
        />
      </PageContainer>
    );
  }

  const resumen = resumenQ.data!;
  const presupuesto = presupuestoDelMes(presupuestoQ.data, mesMx);

  return (
    <PageContainer>
      <PageHeader
        icon={<ShieldCheck className="h-6 w-6 text-primary" />}
        title="Higiene del pipeline"
        description="Calidad del registro, seguimiento dentro de SLA y cobertura contra el presupuesto del mes."
      />
      <div className="space-y-4">
        <HigieneKpis
          resumen={resumen}
          cobertura={coberturaPonderada(resumen.pipeline_ponderado, presupuesto)}
          presupuestoMes={presupuesto}
        />
        <HigieneTabla filas={filasQ.data ?? []} />
      </div>
    </PageContainer>
  );
}
