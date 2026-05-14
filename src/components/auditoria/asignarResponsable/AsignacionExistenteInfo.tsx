import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import type { AuditoriaRevision } from "@/types/auditoria";

interface Props {
  revisionExistente: AuditoriaRevision;
}

export function AsignacionExistenteInfo({ revisionExistente }: Props) {
  return (
    <div className="rounded-md border bg-muted/40 p-2 text-[11px] space-y-0.5">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Estado actual:</span>{" "}
        <Badge variant="outline" className="text-[10px] capitalize">
          {revisionExistente.estado_revision.replace("_", " ")}
        </Badge>
      </div>
      <div>
        <span className="text-muted-foreground">Responsable:</span>{" "}
        <span className="font-medium">{revisionExistente.responsable_email}</span>
      </div>
      {revisionExistente.asignado_por_email && (
        <div>
          <span className="text-muted-foreground">Asignado por:</span>{" "}
          <span>{revisionExistente.asignado_por_email}</span>
          {revisionExistente.asignado_at && (
            <span className="text-muted-foreground tabular-nums">
              {" "}
              · {format(new Date(revisionExistente.asignado_at), "dd/MM/yyyy HH:mm")}
            </span>
          )}
        </div>
      )}
      {revisionExistente.fecha_limite && (
        <div>
          <span className="text-muted-foreground">Fecha límite:</span>{" "}
          <span className="tabular-nums">
            {format(new Date(`${revisionExistente.fecha_limite}T00:00:00`), "dd/MM/yyyy")}
          </span>
        </div>
      )}
    </div>
  );
}
