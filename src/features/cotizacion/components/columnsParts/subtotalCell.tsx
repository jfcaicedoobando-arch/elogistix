/**
 * Celda de subtotal del listado de cotizaciones.
 * Cotizaciones mixtas (conceptos en USD y MXN) muestran un renglón por moneda;
 * antes sólo se veía el monto de la columna plana `subtotal` (una sola moneda).
 */
import { formatCurrency } from "@/lib/formatters";
import { subtotalesPorMoneda, type SubtotalMoneda } from "@/features/cotizacion/domain/subtotalesPorMoneda";

interface FilaSubtotal {
  conceptos_venta?: unknown;
  subtotal?: number | null;
  moneda?: string | null;
}

export function subtotalesDeFila(fila: FilaSubtotal): SubtotalMoneda[] {
  return subtotalesPorMoneda(fila.conceptos_venta, fila.subtotal, fila.moneda);
}

export function SubtotalCotizacionCell({ cotizacion }: { cotizacion: FilaSubtotal }) {
  const subtotales = subtotalesDeFila(cotizacion);
  if (subtotales.length === 0) {
    return <span className="block text-right text-muted-foreground">—</span>;
  }
  return (
    <span className="block text-right tabular-nums whitespace-nowrap">
      {subtotales.map((s) => (
        <span key={s.moneda} className="block">
          {formatCurrency(s.monto, s.moneda)}
        </span>
      ))}
    </span>
  );
}
