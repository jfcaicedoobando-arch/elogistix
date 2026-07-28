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
