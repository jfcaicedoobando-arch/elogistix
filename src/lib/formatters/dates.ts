import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { Locale } from "date-fns";

/** Formatea una fecha ISO a formato legible. Acepta formato y locale opcionales. */
export const formatDate = (
  dateStr: string,
  formatStr: string = 'dd/MM/yyyy',
  options?: { locale?: Locale },
): string => {
  if (!dateStr) return '-';
  try {
    return format(parseISO(dateStr), formatStr, { locale: options?.locale ?? es });
  } catch {
    return dateStr;
  }
};

/**
 * Zona horaria de negocio. Sin fijarla, un usuario con la laptop en otra zona
 * (o un runner de CI en UTC) veía un día distinto al del listado. Se puede
 * sobrescribir pasando `timeZone` en las opciones.
 */
export const TZ_MX = "America/Mexico_City";

function withTz(options: Intl.DateTimeFormatOptions = {}): Intl.DateTimeFormatOptions {
  return { timeZone: TZ_MX, ...options };
}

/**
 * Formato corto día+mes+hora (es-MX), p.ej. "17 jun, 14:35".
 * Usado por la campanita de notificaciones del portal.
 */
export function formatDateTimeShort(iso: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("es-MX", withTz({
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }));
  } catch {
    return iso;
  }
}

/**
 * Fecha corta es-MX (dd/mm/aaaa por defecto). Acepta ISO `yyyy-mm-dd`
 * (se ancla a mediodía para evitar shifts de zona horaria) o ISO con hora.
 * Opciones passthrough a `toLocaleDateString`.
 * PR-5 · Ítem 3.4: reemplaza `new Date(iso).toLocaleDateString("es-MX", …)` inline.
 */
export function formatFechaEs(
  iso: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!iso) return "-";
  try {
    // Una fecha "sólo día" no tiene hora: se ancla a mediodía UTC para que
    // ninguna zona horaria la corra al día anterior/siguiente.
    const soloDia = /^\d{4}-\d{2}-\d{2}$/.test(iso);
    const anchored = soloDia ? `${iso}T12:00:00Z` : iso;
    return new Date(anchored).toLocaleDateString("es-MX", withTz(options));
  } catch {
    return iso;
  }
}

/**
 * Fecha + hora corta es-MX. Por defecto `dateStyle: "short"` + `timeStyle: "short"`.
 * Acepta `Intl.DateTimeFormatOptions` para casos que requieran segundos,
 * año de 2 dígitos, mes largo, etc. (usa `toLocaleString` bajo el capó).
 */
export function formatFechaHora(
  iso: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" },
): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("es-MX", withTz(options));
  } catch {
    return iso;
  }
}


/**
 * Fecha larga es-MX ("lunes, 23 de julio de 2026"). Con capitalización opcional
 * de la primera letra (por defecto sí, para uso en encabezados).
 */
export function formatFechaLarga(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  },
  capitalize = true,
): string {
  if (!date) return "-";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    const s = d.toLocaleDateString("es-MX", withTz(options));
    return capitalize ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  } catch {
    return String(date);
  }
}
