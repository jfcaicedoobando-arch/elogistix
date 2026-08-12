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
import { calcularDiasVencidoFactura } from "@/features/facturacion/domain/facturaAging";

export function diasVencidoCartera(
  fechaVencimiento: string | null | undefined,
  diasVencidoRpc: number,
): number {
  if (!fechaVencimiento) return diasVencidoRpc;
  return calcularDiasVencidoFactura(fechaVencimiento) ?? diasVencidoRpc;
}
