/**
 * Aging de mora para el detalle de factura CxC. Reutiliza `diasHastaFecha`
 * (medianoche local) y expone el mismo signo que `dias_vencido` de
 * `cobranza.ts`: positivo = ya venció, 0 = vence hoy, negativo = faltan días.
 */
import { diasHastaFecha } from "@/lib/date/dateOnly";

export function calcularDiasVencidoFactura(
  fechaVencimiento: string | null | undefined,
  hoy: Date = new Date(),
): number | null {
  if (!fechaVencimiento) return null;
  return -diasHastaFecha(fechaVencimiento, hoy);
}

/**
 * Determina si el botón "Enviar recordatorio" debe mostrarse: sólo con
 * saldo pendiente y factura vigente (no cancelada/sustituida). El permiso
 * de cobranza (`canRegistrarCobro`) se evalúa fuera de este helper.
 */
export function puedeEnviarRecordatorio(params: {
  saldo: number;
  estaCancelada: boolean;
}): boolean {
  return !params.estaCancelada && params.saldo > 0.01;
}
