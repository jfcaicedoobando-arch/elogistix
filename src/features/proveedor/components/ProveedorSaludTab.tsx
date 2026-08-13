/**
 * Pestaña Salud del proveedor: alertas proactivas, KPIs de salud, scorecard
 * de facturación, tendencia 12 meses y comparativo con otros proveedores.
 * Composición delgada (Ola 4).
 */
import { KpiGridSkeleton } from "@/components/shared/skeletons";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { useProveedorSalud } from "@/features/cxp/hooks/useProveedorSalud";
import { useProveedorInteligencia } from "@/features/proveedor/hooks/useProveedorInteligencia";
import { ProveedorSaludKpis } from "./ProveedorSaludKpis";
import { ProveedorScorecardCards } from "./ProveedorScorecardCards";
import { ProveedorTendenciaChart } from "./ProveedorTendenciaChart";
import { ProveedorComparativoCard } from "./ProveedorComparativoCard";
import { ProveedorAlertasCard } from "./ProveedorAlertasCard";

export function ProveedorSaludTab({ proveedorId }: { proveedorId: string }) {
  const salud = useProveedorSalud(proveedorId);
  const intel = useProveedorInteligencia(proveedorId);

  if (salud.isLoading || intel.isLoading) {
    return <KpiGridSkeleton count={6} heightClass="h-24" desktopCols={3} />;
  }

  if (intel.isError || salud.isError) {
    const err = intel.error ?? salud.error;
    return (
      <ErrorStateInline
        title="No pudimos cargar la salud del proveedor"
        message={err instanceof Error ? err.message : "Error desconocido al consultar la información."}
        onRetry={() => { void salud.refetch(); void intel.refetch(); }}
        retrying={salud.isFetching || intel.isFetching}
      />
    );
  }

  if (!salud.data || !intel.data) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Sin información suficiente para calificar a este proveedor.
      </p>
    );
  }

  const { scorecard, tendencia, comparativo, alertas, tipoProveedor, tc } = intel.data;

  return (
    <div className="space-y-5">
      <ProveedorAlertasCard alertas={alertas} />

      {tc.faltante && (
        <p className="text-xs text-warning">
          Falta el tipo de cambio del DOF: los montos en dólares o euros no están incluidos en los totales en pesos.
        </p>
      )}

      <ProveedorSaludKpis data={salud.data} />
      <ProveedorScorecardCards scorecard={scorecard} />
      <ProveedorTendenciaChart tendencia={tendencia} />
      <ProveedorComparativoCard comparativo={comparativo} tipoProveedor={tipoProveedor} />
    </div>
  );
}
