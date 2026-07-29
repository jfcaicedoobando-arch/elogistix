/**
 * Cuerpo tabular del ConciliacionDetalleSheet: renglones y totales por moneda.
 * Extraído de `ConciliacionDetalleSections.tsx` (v13.342.0) para respetar el
 * techo Power of 10 (<200 líneas por archivo).
 */
import { formatCurrency } from "@/lib/formatters";
import type {
  calcularResumenPorMoneda,
  fetchReconciliacionEmbarque,
} from "@/features/embarques/services/reconciliacionCostos";
import { classFromNumber } from "./ConciliacionDetalleHelpers";
import { FilaRenglon } from "./ConciliacionDetalleFilaRenglon";

export type FilasType = Awaited<ReturnType<typeof fetchReconciliacionEmbarque>>;
export type TotalesMoneda = ReturnType<typeof calcularResumenPorMoneda>;

export function TablaBody({ filas, expandidos, onToggle, onVincular }: {
  filas: FilasType; expandidos: Set<string>;
  onToggle: (id: string) => void; onVincular: (id: string) => void;
}) {
  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 text-2xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="w-6 p-2"></th>
            <th className="text-left p-2">Concepto</th>
            <th className="text-right p-2">Cotizado</th>
            <th className="text-right p-2">Real</th>
            <th className="text-right p-2">Δ</th>
            <th className="text-right p-2">%</th>
            <th className="text-left p-2">Estatus</th>
            <th className="w-16 p-2"></th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <FilaRenglon
              key={f.concepto_costo_id}
              fila={f}
              expandido={expandidos.has(f.concepto_costo_id)}
              onToggle={() => onToggle(f.concepto_costo_id)}
              onVincular={() => onVincular(f.concepto_costo_id)}
            />
          ))}
        </tbody>
      </table>
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
            className="rounded-md border bg-muted/30 px-3 py-2 grid grid-cols-5 gap-2 text-xs tabular-nums"
          >
            <div className="font-semibold">TOTAL {t.moneda}</div>
            <div className="text-right">{formatCurrency(t.cotizado, t.moneda)}</div>
            <div className="text-right">{formatCurrency(t.real, t.moneda)}</div>
            <div className={`text-right font-medium ${classFromNumber(t.diferencia)}`}>
              {formatCurrency(t.diferencia, t.moneda)}
            </div>
            <div className={`text-right ${classFromNumber(t.desviacion_pct)}`}>
              {t.desviacion_pct.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
