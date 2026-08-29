import type { SubtotalMoneda } from "@/features/cotizacion/domain/subtotalesPorMoneda";
import { subtotalesPorMoneda } from "@/features/cotizacion/domain/subtotalesPorMoneda";

interface FilaSubtotal {
  conceptos_venta?: unknown;
  subtotal?: number | null;
  moneda?: string | null;
}

export function subtotalesDeFila(fila: FilaSubtotal): SubtotalMoneda[] {
  return subtotalesPorMoneda(fila.conceptos_venta, fila.subtotal, fila.moneda);
}
