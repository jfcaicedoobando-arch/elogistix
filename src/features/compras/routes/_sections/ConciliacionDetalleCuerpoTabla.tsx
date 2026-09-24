/**
 * Cuerpo tabular del ConciliacionDetalleSheet: renglones y totales por moneda.
 * Extraído de `ConciliacionDetalleSections.tsx` (v13.342.0) para respetar el
 * techo Power of 10 (<200 líneas por archivo).
 */
import { formatCurrency, formatPercent } from "@/lib/formatters";
import type {
  calcularResumenPorMoneda,
  fetchReconciliacionEmbarque,
} from "@/features/embarques/services/reconciliacionCostos";
import { classFromNumber } from "./ConciliacionDetalleHelpers";
import { FilaRenglon } from "./ConciliacionDetalleFilaRenglon";

import { Table, TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead } from "@/components/shared/DetailTable";
export type FilasType = Awaited<ReturnType<typeof fetchReconciliacionEmbarque>>;
export type TotalesMoneda = ReturnType<typeof calcularResumenPorMoneda>;

export function TablaBody({ filas, expandidos, onToggle, onVincular }: {
  filas: FilasType; expandidos: Set<string>;
  onToggle: (id: string) => void; onVincular: (id: string) => void;
}) {
  return (
    <div className="rounded-md border overflow-hidden">
      <Table className="w-full text-xs">
        <TableHeader className="bg-muted/50 text-2xs uppercase tracking-wide text-muted-foreground">
          <TableRow>
            <DetailTableHead className="w-6"></DetailTableHead>
            <DetailTableHead>Concepto</DetailTableHead>
            <DetailTableHead className="text-right">Cotizado</DetailTableHead>
            <DetailTableHead className="text-right">Real</DetailTableHead>
            <DetailTableHead className="text-right">Δ</DetailTableHead>
            <DetailTableHead className="text-right">%</DetailTableHead>
            <DetailTableHead>Estatus</DetailTableHead>
            <DetailTableHead className="w-16"></DetailTableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((f) => (
            <FilaRenglon
              key={f.concepto_costo_id}
              fila={f}
              expandido={expandidos.has(f.concepto_costo_id)}
              onToggle={() => onToggle(f.concepto_costo_id)}
              onVincular={() => onVincular(f.concepto_costo_id)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function TotalesMonedaFooter({ totalesPorMoneda }: { totalesPorMoneda: TotalesMoneda }) {
  return (
    <div className="mt-3 overflow-x-auto [scrollbar-width:thin]">
      <div className="min-w-[560px] space-y-1">
        {totalesPorMoneda.map((t) => (
          <div
            key={t.moneda}
            data-testid={`total-moneda-${t.moneda}`}
            className="rounded-md border bg-muted/30 px-3 py-2 grid grid-cols-5 gap-2 text-xs tabular-nums"
          >
            <div className="font-semibold">TOTAL {t.moneda}</div>
            <div className="text-right">{formatCurrency(t.cotizado, t.moneda)}</div>
            <div className="text-right">{formatCurrency(t.real, t.moneda)}</div>
            <div className={`text-right font-medium ${t.diferencia === null ? "text-muted-foreground" : classFromNumber(t.diferencia)}`}>
              {t.diferencia === null ? "N/D" : formatCurrency(t.diferencia, t.moneda)}
            </div>
            <div className={`text-right ${t.desviacion_pct === null ? "text-muted-foreground" : classFromNumber(t.desviacion_pct)}`}>
              {t.desviacion_pct === null ? "N/D" : formatPercent(t.desviacion_pct)}
            </div>
            {t.pendientes_tc > 0 && (
              <div className="col-span-5 text-2xs text-warning">
                {t.pendientes_tc} renglón(es) pendiente(s) de tipo de cambio: real parcial, fuera de la variación.
              </div>
            )}
            {t.sin_factura > 0 && (
              <div className="col-span-5 text-2xs text-muted-foreground">
                {t.sin_factura} renglón(es) sin factura: fuera de la variación{t.diferencia === null ? "" : " (variación parcial)"}.
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
