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

/** Desplazamiento (ms) de la zona CDMX respecto a UTC en un instante dado. */
function offsetMsMx(instante: Date): number {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instante);
  const get = (t: string) => Number(partes.find((p) => p.type === t)?.value ?? 0);
  const horaLocal = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return horaLocal - instante.getTime();
}

const RE_DATETIME_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Convierte un valor `datetime-local` (`YYYY-MM-DDTHH:mm`) que representa hora
 * CDMX al ISO UTC que se persiste. Es la ÚNICA forma correcta: `new Date(valor)`
 * interpreta el texto con la zona del navegador, así que en equipos fuera de
 * CDMX la hora guardada se desplazaba.
 * Devuelve `null` para vacío/ inválido (la fecha suele ser opcional).
 */
export function mxLocalToUtcIso(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const m = RE_DATETIME_LOCAL.exec(valor.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const comoUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0));
  // Doble pasada: cubre los cambios de horario de verano.
  let instante = new Date(comoUtc - offsetMsMx(new Date(comoUtc)));
  instante = new Date(comoUtc - offsetMsMx(instante));
  return Number.isNaN(instante.getTime()) ? null : instante.toISOString();
}

/**
 * Representación `datetime-local` (`YYYY-MM-DDTHH:mm:ss`) de un instante en
 * hora CDMX. Inverso de `mxLocalToUtcIso`.
 */
export function utcIsoToMxLocal(instante: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instante);
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? "00";
  const h = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${h}:${get("minute")}:${get("second")}`;
}

/**
 * Suma `dias` en el calendario CDMX a un instante ISO y devuelve el nuevo ISO
 * UTC, conservando la hora local mexicana. Es la ÚNICA forma correcta de
 * posponer: `new Date(iso).setDate(+n)` suma 24 h del reloj del navegador, lo
 * que desplaza la hora vista por el usuario en equipos fuera de CDMX y en los
 * cambios de horario.
 */
export function mxAddDaysIso(iso: string | null | undefined, dias: number, base: Date = new Date()): string {
  const origen = iso ? new Date(iso) : base;
  const instante = Number.isNaN(origen.getTime()) ? base : origen;
  const local = utcIsoToMxLocal(instante);
  const [fecha, hora] = local.split("T");
  const [y, m, d] = fecha.split("-").map(Number);
  const dia = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  dia.setUTCDate(dia.getUTCDate() + dias);
  return mxLocalToUtcIso(`${isoUtcDay(dia)}T${hora}`) ?? instante.toISOString();
}

/**
 * Día de negocio (`YYYY-MM-DD`, calendario CDMX) de un valor date-only o ISO
 * con hora. Los date-only ya SON días de negocio: se devuelven tal cual (no
 * se reinterpretan como UTC). Devuelve `null` si el valor no es parseable.
 */
export function diaMx(valor: string | Date | null | undefined): string | null {
  if (!valor) return null;
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor.trim())) {
    return valor.trim();
  }
  const d = typeof valor === "string" ? new Date(valor) : valor;
  return Number.isNaN(d.getTime()) ? null : hoyMx(d);
}

/**
 * Límites (ISO UTC) del día de negocio CDMX que contiene `base`. Es la ÚNICA
 * forma correcta de acotar "hoy" en consultas: `setHours(0,0,0,0)` usa el reloj
 * del navegador, así que un usuario en UTC veía el día equivocado.
 */
export function limitesDiaMx(base: Date = new Date()): { inicio: string; fin: string } {
  const dia = hoyMx(base);
  return {
    inicio: mxLocalToUtcIso(`${dia}T00:00:00`) ?? base.toISOString(),
    fin: mxLocalToUtcIso(`${dia}T23:59:59`) ?? base.toISOString(),
  };
}

/**
 * Días de calendario CDMX entre dos valores (positivo si `hasta` es posterior).
 * Inmune a la zona del navegador y al horario de verano.
 */
export function diffDiasMx(
  desde: string | Date | null | undefined,
  hasta: string | Date | null | undefined,
): number | null {
  const a = diaMx(desde);
  const b = diaMx(hasta);
  if (!a || !b) return null;
  return Math.round((parseLocalMx(b).getTime() - parseLocalMx(a).getTime()) / 86_400_000);
}
