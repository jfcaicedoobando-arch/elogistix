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
 * Formato corto día+mes+hora (es-MX), p.ej. "17 jun, 14:35".
 * Usado por la campanita de notificaciones del portal.
 */
export function formatDateTimeShort(iso: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Fecha corta es-MX (dd/mm/aaaa por defecto). Acepta ISO `yyyy-mm-dd`
 * (se ancla a mediodía UTC para evitar shifts de zona horaria) o ISO con hora.
 * Opciones passthrough a `toLocaleDateString`.
 * PR-5 · Ítem 3.4: reemplaza `new Date(iso).toLocaleDateString("es-MX", …)` inline.
 */
export function formatFechaEs(
  iso: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!iso) return "-";
  try {
    const anchored = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso;
    return new Date(anchored).toLocaleDateString("es-MX", options);
  } catch {
    return iso;
  }
}

/**
 * Fecha + hora corta es-MX (`dateStyle: "short", timeStyle: "short"`).
 * Usado en tarjetas de historial/tracking donde se muestra timestamp del evento.
 */
export function formatFechaHora(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });
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
    const s = d.toLocaleDateString("es-MX", options);
    return capitalize ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  } catch {
    return String(date);
  }
}
