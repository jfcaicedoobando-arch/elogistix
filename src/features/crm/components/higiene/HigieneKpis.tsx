/**
 * Tarjetas KPI del tablero de Higiene del pipeline.
 */
import { formatPercent } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/formatters/numbers";
import type { HigieneResumen } from "@/features/crm/services/higiene";
import type { PresupuestoDelMes } from "@/features/crm/domain/higieneMetas";
import { copiaOportunidadesCompletas } from "./higieneKpisCopy";

interface Props {
  resumen: HigieneResumen;
  cobertura: number | null;
  presupuestoMes: PresupuestoDelMes;
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-body-sm text-muted-foreground">{label}</p>
        <p className="text-kpi mt-1">{value}</p>
        {hint && <p className="text-body-sm text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * Sin oportunidades abiertas no hay muestra: mostrar 0% haría leer "mal
 * desempeño" cuando en realidad no hay nada que medir.
 */
function KpiPorcentaje({ label, pct, hint }: { label: string; pct: number | null; hint: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-body-sm text-muted-foreground">{label}</p>
        <p className="text-kpi mt-1">{pct === null ? "—" : `${pct}%`}</p>
        {pct !== null && <Progress value={pct} className="mt-2" />}
        <p className="text-body-sm text-muted-foreground mt-1">{pct === null ? "Requiere oportunidades abiertas para medirse" : hint}</p>
      </CardContent>
    </Card>
  );
}

export default function HigieneKpis({ resumen, cobertura, presupuestoMes }: Props) {
  const sinMuestra = resumen.abiertas === 0;
  const higienePct = sinMuestra ? null : Math.round(resumen.higiene_pct * 100);
  const seguimientoPct = sinMuestra ? null : Math.round(resumen.seguimiento_oportuno_pct * 100);
  // El pipeline ponderado viene en MXN; con presupuesto en USD/EUR no hay
  // conversión histórica válida, así que no se inventa un porcentaje.
  const sinConversion = presupuestoMes.monto > 0 && presupuestoMes.moneda !== "MXN";
  const valorCobertura = sinConversion
    ? "Sin conversión"
    : cobertura === null
      ? "Sin presupuesto"
      : formatPercent(cobertura * 100, 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiPorcentaje
        label="Higiene del pipeline"
        pct={higienePct}
        hint={`${resumen.registros_completos} de ${resumen.abiertas} oportunidades completas`}
      />
      <KpiPorcentaje
        label="Seguimiento oportuno"
        pct={seguimientoPct}
        hint={`${resumen.vencidas} fuera de SLA · ${resumen.sin_actividad_programada} sin próxima actividad`}
      />
      <Kpi
        label="Pipeline ponderado"
        value={formatCurrency(resumen.pipeline_ponderado, "MXN")}
        hint={`Bruto ${formatCurrency(resumen.pipeline_bruto, "MXN")}${
          // UI-15: el pipeline se convierte a MXN con el T/C DOF vigente; si
          // faltó T/C para alguna moneda extranjera, la cifra es estimada.
          resumen.tc_estimado ? " · (T/C estimado)" : ""
        }`}
      />
      <Kpi
        label="Cobertura vs presupuesto"
        value={valorCobertura}
        hint={
          presupuestoMes.monto > 0
            ? `Meta del mes ${formatCurrency(presupuestoMes.monto, presupuestoMes.moneda)}`
            : "Captura el presupuesto en Configuración del CRM"
        }
      />
    </div>
  );
}
