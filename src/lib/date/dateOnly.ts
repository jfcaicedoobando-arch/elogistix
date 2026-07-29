/**
 * Helpers para fechas "date-only" (`YYYY-MM-DD`) ancladas a hora LOCAL
 * (México), complementarios de `todayLocalISO` (`src/lib/date/today.ts`).
 *
 * B-089: `new Date('2026-07-28')` y `parseISO('2026-07-28')` parsean el
 * date-only como MEDIANOCHE UTC — en México (UTC−6) eso es 18:00 del día
 * ANTERIOR, y cualquier comparación "vs hoy" se desfasa un día (tarifa que
 * vence hoy dada por vencida, "vencida hace 1 d" falso, KPI ≤7d que incluye
 * las de 8). Regla: todo date-only se ancla a medianoche LOCAL.
 */

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parsea un date-only `YYYY-MM-DD` como medianoche LOCAL. Si el string trae
 * hora (ISO completo), delega al parseo nativo.
 */
export function parseDateOnlyLocal(iso: string): Date {
  if (DATE_ONLY_RE.test(iso)) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(iso);
}

/**
 * Suma días naturales a un date-only `YYYY-MM-DD` y devuelve otro date-only.
 * Espejo exacto de `fecha_emision + dias_credito` en Postgres, usado para
 * previsualizar el vencimiento de una factura antes de guardarla (v13.331.9).
 * Devuelve `null` si la fecha o los días no son válidos.
 */
export function addDaysIso(iso: string | null | undefined, days: number): string | null {
  if (!iso || !DATE_ONLY_RE.test(iso.slice(0, 10))) return null;
  if (!Number.isFinite(days)) return null;
  const base = parseDateOnlyLocal(iso.slice(0, 10));
  base.setDate(base.getDate() + Math.trunc(days));
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}



/**
 * Días naturales de hoy (medianoche local) a la fecha date-only dada.
 * Negativo si ya pasó. Usa Math.round para ser inmune al cambio de horario
 * (DST), a diferencia de Math.floor((utcMs - hoyMs) / 86400000).
 */
export function diasHastaFecha(iso: string, hoy: Date = new Date()): number {
  const target = parseDateOnlyLocal(iso);
  const base = new Date(hoy);
  base.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - base.getTime()) / 86_400_000);
}

/**
 * Q-15.1 · Formatea un `Date` a `YYYY-MM-DD` usando sus componentes LOCALES.
 * Es el espejo exacto de `parseDateOnlyLocal`: si el Date se creó con
 * `new Date(y, m, d)` (medianoche local), este helper devuelve ese mismo día
 * en cualquier zona horaria. Usar `isoUtcDay` sobre un Date local corre el
 * día uno hacia atrás en zonas UTC+ (off-by-one de semanas del flujo).
 */
export function formatDateOnlyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
