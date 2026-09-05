/**
 * Etiqueta legible de la próxima actividad de una oportunidad (v13.629.1).
 * Vive fuera de los componentes para no romper fast-refresh.
 */
import { formatFechaEs } from "@/lib/formatters/dates";
import type { ProximaActividad } from "@/features/crm/hooks";
import { diffDiasMx } from "@/lib/date/mx";

export function formatProx(prox: ProximaActividad | undefined): string {
  if (!prox) return "Sin próxima acción";
  if (!prox.fecha_programada) return prox.asunto;
  // Calendario de negocio CDMX: sin anclar, un usuario en UTC veía "Hoy"
  // en una actividad de ayer/mañana.
  const diff = diffDiasMx(new Date(), prox.fecha_programada);
  if (diff === null) return prox.asunto;
  if (diff < 0) return `Vencida · ${prox.asunto}`;
  if (diff === 0) return `Hoy · ${prox.asunto}`;
  if (diff === 1) return `Mañana · ${prox.asunto}`;
  return `${formatFechaEs(prox.fecha_programada)} · ${prox.asunto}`;
}
