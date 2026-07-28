/**
 * Estados de factura considerados "vivos" para efectos de reportería.
 * Excluye `Borrador` (aún no emitida), `Cancelada` (revertida ante SAT) y
 * `Sustituida` (reemplazada por otro CFDI vigente): ninguno debe sumar en
 * KPIs, cartera, EERR, portal cliente ni exportaciones financieras.
 *
 * Cambiar esta lista impacta reportes en toda la app — antes de tocarla,
 * revisar `src/lib/__tests__/facturas-estados-reportes.test.ts`.
 */
import { todayLocalISO } from "@/lib/date/today";

export const FACTURA_ESTADOS_VIVOS = [
  "Emitida",
  "Pagada",
  "Parcialmente pagada",
  "Vencida",
] as const;

/**
 * B-083: UNA sola clasificación de estado para mostrar al cliente en todo el
 * portal. El estado de cuenta deriva "Vencida" por fecha; la lista y el
 * detalle mostraban el estado crudo de la columna → misma factura, dos
 * estados. Regla compartida: Emitida/Parcialmente pagada con
 * fecha_vencimiento anterior a hoy (date-only, hora local) ⇒ "Vencida".
 */
export function resolverEstadoFacturaCliente(
  estado: string,
  fechaVencimiento: string | null | undefined,
  hoy: string = todayLocalISO(),
): string {
  if (
    (estado === "Emitida" || estado === "Parcialmente pagada") &&
    fechaVencimiento &&
    fechaVencimiento < hoy
  ) {
    return "Vencida";
  }
  return estado;
}


