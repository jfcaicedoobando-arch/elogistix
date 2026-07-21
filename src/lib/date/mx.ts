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
 * Convierte un string "YYYY-MM-DD" en un Date que representa la medianoche
 * LOCAL (CDMX). No usamos `new Date("YYYY-MM-DD")` porque el parser lo trata
 * como UTC y sale corrido un día en producción.
 */
export function parseLocalMx(fecha: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}
