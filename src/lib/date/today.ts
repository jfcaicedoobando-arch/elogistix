/**
 * Helper único para obtener "hoy" en hora local (México), formateado ISO
 * `YYYY-MM-DD`.
 *
 * Reemplaza al patrón `new Date().toISOString().slice(0, 10)` que devuelve el
 * día en UTC — entre 18:00 y 23:59 (hora local UTC−6) ya cae en el día
 * siguiente, produciendo defaults/filtros/vencimientos con desfase de un día.
 *
 * Referencia: mem://principles/power-of-10 y auditoría de captura de fechas
 * (v13.303.9).
 */
import { format } from "date-fns";

export function todayLocalISO(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}

/** Suma `days` días naturales a hoy (hora local) y devuelve ISO `YYYY-MM-DD`. */
export function todayLocalISOPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return format(d, "yyyy-MM-dd");
}
