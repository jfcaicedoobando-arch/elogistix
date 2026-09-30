import { Badge } from "@/components/ui/badge";
import { Hint } from "@/components/shared/Hint";
import { ACTIVIDAD_ENTIDAD_LABEL } from "@/features/crm/domain/actividadLabels";
import { actividadEntidadHref, actividadEntidadNombre } from "@/features/crm/domain/actividadEntidad";
import type { CrmActividadRow } from "@/features/crm/hooks";

/** El drilldown es la fila/tarjeta completa de ResponsiveDataTable. */
export function ActividadEntidad({ actividad }: { actividad: CrmActividadRow }) {
  const nombre = actividadEntidadNombre(actividad);
  const navegable = !!actividadEntidadHref(actividad);
  return <div className="min-w-0 space-y-1">
    <Badge variant="neutral">{ACTIVIDAD_ENTIDAD_LABEL[actividad.entidad_tipo]}</Badge>
    <Hint label={nombre}>
      <span tabIndex={0} className={`block truncate rounded text-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${navegable ? "font-medium text-primary underline decoration-dotted underline-offset-2" : "text-muted-foreground"}`}>{nombre}</span>
    </Hint>
  </div>;
}
