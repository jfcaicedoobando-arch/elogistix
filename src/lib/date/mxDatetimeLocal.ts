/**
 * Conversión entre el valor de un `<input type="datetime-local">` (hora CDMX)
 * y el ISO UTC que se persiste. Extraído de `mx.ts` (Power of 10: ≤200 líneas);
 * el comportamiento es idéntico y `mx.ts` sigue re-exportando estas funciones.
 */
import { TZ_MX } from "./mxTz";

/** Desplazamiento (ms) de la zona CDMX respecto a UTC en un instante dado. */
function offsetMsMx(instante: Date): number {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_MX,
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
  const comoUtc = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s ?? 0),
  );
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
    timeZone: TZ_MX,
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
