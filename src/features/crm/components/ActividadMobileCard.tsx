import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatFechaHora } from "@/lib/formatters/dates";
import type { CrmActividadRow } from "@/features/crm/hooks";
import { ACTIVIDAD_ENTIDAD_LABEL, ACTIVIDAD_TIPO_LABEL, actividadTipoVariant } from "@/features/crm/domain/actividadLabels";

export function ActividadMobileCard({ actividad }: { actividad: CrmActividadRow }) {
  const estado = actividad.fecha_completada
    ? "Completada"
    : actividad.fecha_programada && new Date(actividad.fecha_programada).getTime() < Date.now()
      ? "Vencida"
      : "Pendiente";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={actividadTipoVariant(actividad.tipo)}>{ACTIVIDAD_TIPO_LABEL[actividad.tipo]}</Badge>
        <Badge variant="neutral">{ACTIVIDAD_ENTIDAD_LABEL[actividad.entidad_tipo]}</Badge>
        <StatusBadge domain="actividad_crm" status={estado} />
      </div>
      <p className="font-medium text-body break-words">{actividad.asunto}</p>
      <p className="text-body-sm text-muted-foreground">
        Programada: {actividad.fecha_programada ? formatFechaHora(actividad.fecha_programada) : "Sin fecha"}
      </p>
    </div>
  );
}