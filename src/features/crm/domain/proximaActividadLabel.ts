/**
 * Etiqueta legible de la próxima actividad de una oportunidad (v13.629.1).
 * Vive fuera de los componentes para no romper fast-refresh.
 */
import { formatFechaEs } from "@/lib/formatters/dates";
import type { ProximaActividad } from "@/features/crm/hooks";
import { diffDiasCalendario } from "@/lib/date/dateOnly";

export function formatProx(prox: ProximaActividad | undefined): string {
  if (!prox) return "Sin próxima acción";
  if (!prox.fecha_programada) return prox.asunto;
  const diff = diffDiasCalendario(new Date(), prox.fecha_programada);
  if (diff < 0) return `Vencida · ${prox.asunto}`;
  if (diff === 0) return `Hoy · ${prox.asunto}`;
  if (diff === 1) return `Mañana · ${prox.asunto}`;
  return `${formatFechaEs(prox.fecha_programada)} · ${prox.asunto}`;
}
