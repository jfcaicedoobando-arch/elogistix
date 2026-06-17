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
