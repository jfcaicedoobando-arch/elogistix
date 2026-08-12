/**
 * Canon compartido de "días vencido" de una factura (CxC y bandejas de
 * cartera). Vive en `src/lib/domain/` porque lo consumen varias features y las
 * reglas de arquitectura prohíben importar `facturacion/domain` desde fuera.
 *
 * Signo (igual que `dias_vencido` de `cobranza.ts`):
 *   positivo = ya venció · 0 = vence hoy · negativo = faltan días.
 */
import { diasHastaFecha } from "@/lib/date/dateOnly";

export function calcularDiasVencidoFactura(
  fechaVencimiento: string | null | undefined,
  hoy: Date = new Date(),
): number | null {
  if (!fechaVencimiento) return null;
  // `|| 0` normaliza el -0 que produce negar un cero (rompe toBe(0)).
  return -diasHastaFecha(fechaVencimiento, hoy) || 0;
}
