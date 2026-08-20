/**
 * Tarjetas KPI del tablero de Higiene del pipeline.
 */
import { formatPercent } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/formatters/numbers";
import type { HigieneResumen } from "@/features/crm/services/higiene";

interface Props {
  resumen: HigieneResumen;
  cobertura: number | null;
  presupuestoMes: number;
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

export default function HigieneKpis({ resumen, cobertura, presupuestoMes }: Props) {
  const higienePct = Math.round(resumen.higiene_pct * 100);
  const seguimientoPct = Math.round(resumen.seguimiento_oportuno_pct * 100);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <Card>
        <CardContent className="pt-6">
          <p className="text-body-sm text-muted-foreground">Higiene del pipeline</p>
          <p className="text-kpi mt-1">{higienePct}%</p>
          <Progress value={higienePct} className="mt-2" />
          <p className="text-body-sm text-muted-foreground mt-1">
            {resumen.registros_completos} de {resumen.abiertas} oportunidades completas
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <p className="text-body-sm text-muted-foreground">Seguimiento oportuno</p>
          <p className="text-kpi mt-1">{seguimientoPct}%</p>
          <Progress value={seguimientoPct} className="mt-2" />
          <p className="text-body-sm text-muted-foreground mt-1">
            {resumen.vencidas} fuera de SLA · {resumen.sin_actividad_programada} sin próxima actividad
          </p>
        </CardContent>
      </Card>
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
        value={cobertura === null ? "Sin presupuesto" : formatPercent(cobertura * 100, 0)}
        hint={
          presupuestoMes > 0
            ? `Meta del mes ${formatCurrency(presupuestoMes, "MXN")}`
            : "Captura el presupuesto en Configuración del CRM"
        }
      />
    </div>
  );
}
