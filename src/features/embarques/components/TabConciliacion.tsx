/**
 * Pestaña "Conciliación" del detalle de embarque.
 *
 * Foco reducido (v13.216.1): sólo lo que no vive en el tab Costos.
 *   - Banner con la "Decisión aplicada" sobre la tarifa cotizada.
 *   - Vista 3 columnas: Cotizado · Refrescado (tarifa vigente) · Real.
 *
 * El detalle por proveedor + facturas ligadas y la Δ cotizado-vs-real
 * ahora viven en el tab Costos (`TabCostos`), agrupados por proveedor.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEmbarqueTarifaInfo } from "@/features/embarques/hooks/useEmbarqueTarifaInfo";
import { ReconciliacionTresColumnas } from "@/features/embarques/components/reconciliacion/ReconciliacionTresColumnas";

const DECISION_NICE: Record<string, string> = {
  sin_cambios: "Sin cambios respecto a la tarifa cotizada",
  mantenida_por_operaciones: "Mantenida por operaciones (delta absorbido)",
  refrescada: "Refrescada desde la tarifa vigente",
  sustituida: "Sustituida por otra tarifa",
  reaprobada_ventas: "Re-aprobada por ventas",
};

interface Props {
  embarqueId: string;
}

export function TabConciliacion({ embarqueId }: Props) {
  const { data: tarifaInfo } = useEmbarqueTarifaInfo(embarqueId);
  const decisionLabel = tarifaInfo?.tarifa_decision
    ? DECISION_NICE[tarifaInfo.tarifa_decision] ?? tarifaInfo.tarifa_decision
    : null;

  return (
    <div className="space-y-6">
      {decisionLabel && (
        <div className="rounded-md border border-info/30 bg-info/10 px-3 py-2 text-xs text-info-foreground flex items-center gap-2">
          <span className="font-medium">Decisión aplicada:</span>
          <span>{decisionLabel}</span>
          <span className="text-muted-foreground">— ver pestaña Resumen → Origen de costos para el detalle.</span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Reconciliación 3 columnas (Cotizado · Refrescado · Real)</CardTitle>
        </CardHeader>
        <CardContent>
          <ReconciliacionTresColumnas embarqueId={embarqueId} />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        El detalle por proveedor y las facturas ligadas ahora viven en la pestaña <span className="font-medium">Costos</span>.
      </p>
    </div>
  );
}
