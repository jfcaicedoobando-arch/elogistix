/**
 * Fechas en la zona de negocio America/Mexico_City.
 * FIX-12 (auditoría v3): antes usábamos `toISOString().slice(0,10)` en varios
 * lugares — eso devuelve la fecha UTC y entre las 18:00–23:59 CDMX ya está
 * en el día siguiente. Estos helpers son la ÚNICA forma correcta de derivar
 * "hoy" o "mes en curso" para lógica de negocio (elección del TC del DOF,
 * buckets del dashboard, cortes de recordatorios de CxC).
 */

const TZ = "America/Mexico_City";

/** YYYY-MM-DD en zona CDMX. */
export function hoyMx(base: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(base);
}

/** YYYY-MM en zona CDMX. */
export function ymMx(base: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
  })
    .format(base)
    .slice(0, 7);
}

/**
 * Convierte "YYYY-MM-DD" en un Date que representa mediodía UTC. Usar mediodía
 * (no medianoche local) evita que la aritmética de días + `hoyMx()` se corra
 * un día en runners con TZ != CDMX (p.ej. UTC en CI).
 */
export function parseLocalMx(fecha: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0));
}

/** Suma `dias` naturales a una fecha "YYYY-MM-DD" en zona CDMX. */
export function addDaysMx(fecha: string, dias: number): string {
  const base = parseLocalMx(fecha);
  return hoyMx(new Date(base.getTime() + dias * 86_400_000));
}
