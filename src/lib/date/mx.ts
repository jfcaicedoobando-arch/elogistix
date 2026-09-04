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

/** Hora (0-23) en zona CDMX. Para saludos y cortes por hora de negocio. */
export function horaMx(base: Date = new Date()): number {
  const h = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    hour12: false,
  }).format(base);
  return Number(h === "24" ? "0" : h);
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

/**
 * YYYY-MM-DD tomando los componentes UTC del Date. Úsalo cuando el Date ya
 * está anclado a UTC (`new Date(iso + "T00:00:00Z")` + aritmética UTC) y no
 * quieres que la zona CDMX lo corra 6 h atrás. Para "hoy" real de negocio,
 * usa `hoyMx()`.
 */
export function isoUtcDay(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Primer día del mes en zona CDMX, desplazado `offsetMeses` meses (puede ser
 * negativo). Aritmética entera sobre año/mes — sin ambigüedad de TZ.
 * Usado por leaderboard/forecast para acotar rangos de mes con calendario MX.
 */
export function primerDiaMesMx(offsetMeses = 0, base: Date = new Date()): string {
  const [y, m] = ymMx(base).split("-").map(Number);
  const totalMeses = y * 12 + (m - 1) + offsetMeses;
  const yy = Math.floor(totalMeses / 12);
  const mm = (totalMeses % 12) + 1;
  return `${yy}-${String(mm).padStart(2, "0")}-01`;
}

/** Último día del mes en zona CDMX, desplazado `offsetMeses` meses. */
export function ultimoDiaMesMx(offsetMeses = 0, base: Date = new Date()): string {
  const primerDiaSiguiente = parseLocalMx(primerDiaMesMx(offsetMeses + 1, base));
  primerDiaSiguiente.setUTCDate(primerDiaSiguiente.getUTCDate() - 1);
  return isoUtcDay(primerDiaSiguiente);
}
