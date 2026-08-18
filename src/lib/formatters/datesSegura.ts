/**
 * EC-07 · Formateo defensivo de fechas con patrones de date-fns.
 * Archivo aparte de `dates.ts` para respetar Power-of-10 #4 (<=200 líneas).
 */
import { format, isValid } from "date-fns";
import { es } from "date-fns/locale";
/**
 * EC-07 · Formateo defensivo con patrón de date-fns.
 * `format()` y `Date#toISOString()` lanzan `RangeError: Invalid time value`
 * con una fecha inválida y tumban el render del panel/tabla completo. Este
 * helper valida antes (guard + try/catch) y cae al fallback "—".
 *
 * @param valor ISO string o Date (nullable).
 * @param patron patrón de date-fns, p.ej. "dd/MM/yyyy HH:mm".
 * @param fallback texto cuando la fecha falta o no es parseable (default "—").
 */
export function formatFechaSegura(
  valor: string | Date | null | undefined,
  patron = "dd/MM/yyyy",
  fallback = "—",
): string {
  if (!valor) return fallback;
  try {
    const d = valor instanceof Date ? valor : new Date(valor);
    if (!isValid(d)) return fallback;
    return format(d, patron, { locale: es });
  } catch {
    return fallback;
  }
}
