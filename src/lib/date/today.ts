/**
 * Helper único para obtener "hoy" como día de NEGOCIO (America/Mexico_City),
 * formateado ISO `YYYY-MM-DD`.
 *
 * Reemplaza al patrón `new Date().toISOString().slice(0, 10)` que devuelve el
 * día en UTC — entre 18:00 y 23:59 CDMX ya cae en el día siguiente, produciendo
 * defaults/filtros/vencimientos con desfase de un día. P2 (v13.823.7): antes
 * usaba `format` de date-fns, es decir la zona del NAVEGADOR/runner, no México.
 *
 * Referencia: mem://principles/power-of-10 y `src/lib/date/mx.ts`.
 */
import { hoyMx, parseLocalMx } from "@/lib/date/mx";

export function todayLocalISO(date: Date = new Date()): string {
  return hoyMx(date);
}

/**
 * Suma `days` días naturales al día de negocio (México) y devuelve ISO
 * `YYYY-MM-DD`. La aritmética es date-only sobre mediodía UTC, así que no
 * depende de la zona del navegador ni del horario de verano.
 */
export function todayLocalISOPlus(days: number, date: Date = new Date()): string {
  const base = parseLocalMx(hoyMx(date));
  base.setUTCDate(base.getUTCDate() + Math.trunc(days));
  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, "0");
  const d = String(base.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
