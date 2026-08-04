/**
 * `formatRelativo` — helper único de "tiempo relativo" en es-MX.
 *
 * WAVE 3 (Ítem 16): unifica ~4 implementaciones locales duplicadas
 * (bitácora, banner de borrador, autosave, comentarios de oportunidad)
 * que calculaban "hace X min/h/días" cada una a su manera.
 */

import { formatFechaEs } from "@/lib/formatters";

const MINUTO_MS = 60_000;
const HORA_MS = 60 * MINUTO_MS;
const DIA_MS = 24 * HORA_MS;

/**
 * Da formato relativo a una fecha respecto a `ahora` (por defecto `new Date()`).
 * Reglas:
 * - < 1 min: "hace un momento"
 * - < 60 min: "hace N min"
 * - < 24 h (mismo día): "hace N h"
 * - ayer (día calendario anterior): "ayer"
 * - < 7 días: "hace N días"
 * - resto: fecha corta es-MX (dd/mm/aaaa)
 */
export function formatRelativo(fecha: string | Date, ahora: Date = new Date()): string {
  const fechaObj = typeof fecha === "string" ? new Date(fecha) : fecha;
  if (Number.isNaN(fechaObj.getTime())) return "-";

  const diffMs = ahora.getTime() - fechaObj.getTime();
  if (diffMs < 0) return "hoy";

  const minutos = Math.floor(diffMs / MINUTO_MS);
  if (minutos < 1) return "hace un momento";
  if (minutos < 60) return `hace ${minutos} min`;

  const horas = Math.floor(diffMs / HORA_MS);
  const esMismoDia = fechaObj.toDateString() === ahora.toDateString();
  if (horas < 24 && esMismoDia) return `hace ${horas} h`;

  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);
  if (fechaObj.toDateString() === ayer.toDateString()) return "ayer";

  const dias = Math.floor(diffMs / DIA_MS);
  if (dias < 7) return `hace ${dias} días`;

  return formatFechaEs(fechaObj.toISOString(), { day: "2-digit", month: "2-digit", year: "numeric" });
}
