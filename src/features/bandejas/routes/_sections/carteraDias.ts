/**
 * UIA-07 — Días vencido de Cartera calculados en cliente.
 *
 * La RPC `cartera_pendiente()` devuelve `dias_vencido`, pero versiones previas
 * a la migración N9 lo truncaban con `GREATEST(0, …)`: una factura que vence en
 * 10 días llegaba como `0` y la UI mostraba "Vence hoy". Recalculamos desde
 * `fecha_vencimiento` con el canon local (`calcularDiasVencidoFactura`, misma
 * convención de signo: positivo = vencida, 0 = vence hoy, negativo = por vencer)
 * y sólo caemos al valor de la RPC cuando no hay fecha de vencimiento.
 */
import { calcularDiasVencidoFactura } from "@/lib/domain/facturaDiasVencido";

export function diasVencidoCartera(
  fechaVencimiento: string | null | undefined,
  diasVencidoRpc: number,
): number {
  if (!fechaVencimiento) return diasVencidoRpc;
  return calcularDiasVencidoFactura(fechaVencimiento) ?? diasVencidoRpc;
}

/**
 * B-25 — Etiqueta semántica de vencimiento, compartida por la tabla de
 * escritorio y la lista móvil (antes la móvil pintaba "-5d" en crudo).
 */
export function badgeVencimientoCartera(
  fechaVencimiento: string | null | undefined,
  diasVencidoRpc: number,
): { texto: string; variant: "destructive" | "secondary" | "outline" } {
  const d = diasVencidoCartera(fechaVencimiento, diasVencidoRpc);
  if (d > 0) return { texto: `Vencida ${d}d`, variant: "destructive" };
  if (d === 0) return { texto: "Vence hoy", variant: "secondary" };
  if (d >= -7) return { texto: `Vence en ${Math.abs(d)}d`, variant: "secondary" };
  return { texto: `Vence en ${Math.abs(d)}d`, variant: "outline" };
}
