/**
 * Deriva el estado visible de liquidación de un concepto_costo en 3 valores:
 *   - "Pagado"             → estado_liquidacion = 'Pagado'
 *   - "Pendiente de pago"  → ya hay factura de proveedor vinculada pero sin pagar
 *   - "Pendiente de cargar" → aún no se ha cargado factura de proveedor
 *
 * El modelo de BD sólo guarda `Pendiente | Pagado`; el tercer estado se infiere
 * a partir de `proveedor_facturas_conceptos` (ver `useCostosConFactura`).
 */
import type { ConceptoCostoRow } from "@/features/embarques/types/embarque";

export type EstadoLiquidacionDerivado =
  | "Pagado"
  | "Pendiente de pago"
  | "Pendiente de cargar";

export function getEstadoLiquidacionDerivado(
  concepto: Pick<ConceptoCostoRow, "id" | "estado_liquidacion">,
  costosConFactura: ReadonlySet<string>,
): EstadoLiquidacionDerivado {
  if ((concepto.estado_liquidacion ?? "").toLowerCase() === "pagado") {
    return "Pagado";
  }
  if (costosConFactura.has(concepto.id)) return "Pendiente de pago";
  return "Pendiente de cargar";
}

/** Clases Tailwind para el Badge de cada estado derivado. */
export function getEstadoLiquidacionBadgeClass(
  estado: EstadoLiquidacionDerivado,
): string {
  switch (estado) {
    case "Pagado":
      return "bg-success/15 text-success border-success/30";
    case "Pendiente de pago":
      return "bg-warning/15 text-warning border-warning/30";
    case "Pendiente de cargar":
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
