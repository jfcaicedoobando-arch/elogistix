/**
 * Scorecard ampliado (Ola 4): puntualidad de facturación, desviación
 * presupuesto vs factura, ticket promedio, cobertura de facturación y tops.
 */
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/KpiCard";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { Hint } from "@/components/shared/Hint";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import {
  calcularDesviacion,
  pctPartidasFacturadas,
  semaforoDiasFacturacion,
  type ScorecardProveedor,
  type Semaforo,
} from "@/features/proveedor/domain/inteligenciaProveedor";

const VARIANTE: Record<Semaforo, "success" | "warning" | "destructive" | "default"> = {
  good: "success",
  warn: "warning",
  bad: "destructive",
  neutral: "default",
};

function ListaTop({
  titulo, filas,
}: {
  titulo: string;
  filas: Array<{ etiqueta: string; montoMxn: number; sub: string }>;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <SectionHeading as="h3" variant="subsection" className="mb-3">{titulo}</SectionHeading>
        {filas.length === 0 ? (
          <p className="text-body text-muted-foreground text-center py-4">Sin información en el período.</p>
        ) : (
          <ul className="space-y-2">
            {filas.map((f) => (
              <li key={f.etiqueta} className="flex items-baseline justify-between gap-3 text-body">
                <span className="truncate">
                  {f.etiqueta}
                  <span className="ml-2 text-body-sm text-muted-foreground">{f.sub}</span>
                </span>
                <Hint label={formatCurrency(f.montoMxn, "MXN")}>
                  <span className="tabular-nums font-medium shrink-0">
                    {formatCurrencyCompact(f.montoMxn, "MXN")}
                  </span>
                </Hint>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function ProveedorScorecardCards({ scorecard }: { scorecard: ScorecardProveedor }) {
  const desviacion = calcularDesviacion(scorecard);
  const cobertura = pctPartidasFacturadas(scorecard);
  const toneDias = semaforoDiasFacturacion(scorecard.diasFacturacionProm);

  return (
    <div className="space-y-3">
      <SectionHeading>Desempeño de facturación</SectionHeading>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Días en facturar"
          value={scorecard.diasFacturacionProm == null ? "—" : `${scorecard.diasFacturacionProm.toFixed(1)} d`}
          variant={VARIANTE[toneDias]}
          hint="Promedio entre el registro del costo y la fecha de la factura del proveedor."
        />
        <KpiCard
          label="Desviación vs presupuesto"
          value={desviacion.pct == null ? "—" : `${desviacion.pct > 0 ? "+" : ""}${desviacion.pct.toFixed(1)}%`}
          sublabel={formatCurrency(desviacion.montoMxn, "MXN")}
          variant={VARIANTE[desviacion.semaforo]}
          hint="Comparado solo sobre las partidas que ya tienen factura ligada."
        />
        <KpiCard
          label="Ticket promedio"
          value={scorecard.ticketPromedioMxn == null ? "—" : formatCurrencyCompact(scorecard.ticketPromedioMxn, "MXN")}
          valueTooltip={scorecard.ticketPromedioMxn == null ? undefined : formatCurrency(scorecard.ticketPromedioMxn, "MXN")}
          sublabel={`${scorecard.facturasCount} factura${scorecard.facturasCount === 1 ? "" : "s"}`}
        />
        <KpiCard
          label="Partidas facturadas"
          value={cobertura == null ? "—" : `${cobertura.toFixed(0)}%`}
          sublabel={`${scorecard.partidasFacturadas} de ${scorecard.partidasTotal}`}
          variant={cobertura == null ? "default" : cobertura >= 90 ? "success" : cobertura >= 60 ? "warning" : "destructive"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ListaTop
          titulo="Top conceptos por gasto"
          filas={scorecard.topConceptos.map((c) => ({
            etiqueta: c.concepto,
            montoMxn: c.montoMxn,
            sub: `${c.partidas} partida${c.partidas === 1 ? "" : "s"}`,
          }))}
        />
        <ListaTop
          titulo="Top rutas"
          filas={scorecard.topRutas.map((r) => ({
            etiqueta: r.ruta,
            montoMxn: r.montoMxn,
            sub: `${r.embarques} embarque${r.embarques === 1 ? "" : "s"}`,
          }))}
        />
      </div>
    </div>
  );
}
