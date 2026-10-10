import { roundMoney, subtotalLinea } from "@/lib/financial/financialUtils";

/**
 * Importe sin IVA de un renglón: `cantidad * precio_unitario`. Es la misma
 * base que usa `subtotalesPorMoneda` para la lista, de modo que el encabezado
 * y el listado no puedan divergir.
 */
export function importeVentaSinIva(c: { cantidad?: unknown; precio_unitario?: unknown; subtotal?: unknown; total?: unknown }): number {
  const cantidad = Number(c?.cantidad);
  const precio = Number(c?.precio_unitario);
  if (Number.isFinite(cantidad) && Number.isFinite(precio) && precio !== 0) {
    return subtotalLinea(cantidad, precio);
  }
  // Respaldo para renglones legados sin desglose: `subtotal` ya viene sin IVA.
  const sub = Number(c?.subtotal);
  if (Number.isFinite(sub) && sub !== 0) return roundMoney(sub);
  return Number(c?.total) || 0;
}

