/**
 * Celda "Responsable" de la tabla de hallazgos — extraída de `HallazgosTabla`
 * para bajar la complejidad ciclomática del renderer de la columna.
 *
 * Ola 4 · N29: un hallazgo revisado NO se reasigna desde la tabla (reasignarlo
 * lo reabriría, ver `revisiones.ts`); se muestra como texto plano.
 */
import { formatFechaDia, formatFechaHoraCorta } from "@/lib/formatters";
import { AlertTriangle, UserCheck, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { todayLocalISO } from "@/lib/date/today";
import type { AuditoriaRevision, HallazgoAuditoria } from "@/features/auditoria/types";
import { Hint } from "@/components/shared/Hint";

interface Props {
  hallazgo: HallazgoAuditoria;
  revision: AuditoriaRevision | undefined;
  currentUserId?: string | null;
  onAsignarResponsable: (h: HallazgoAuditoria) => void;
}

function esVencida(fechaLimite: string | null): boolean {
  if (!fechaLimite) return false;
  return fechaLimite < todayLocalISO();
}

function tituloAsignacion(revision: AuditoriaRevision): string {
  const asignadoAt = revision.asignado_at
    ? ` el ${formatFechaHoraCorta(revision.asignado_at)}`
    : "";
  const limite = revision.fecha_limite
    ? `\nFecha límite: ${formatFechaDia(revision.fecha_limite)}`
    : "";
  return `Asignado por ${revision.asignado_por_email || "—"}${asignadoAt}${limite}`;
}

export function HallazgoResponsableCell({
  hallazgo, revision, currentUserId, onAsignarResponsable,
}: Props) {
  const responsable = revision?.responsable_id ? revision : null;

  if (revision?.estado_revision === "revisado") {
    return (
      <Hint label="Hallazgo revisado: la asignación está cerrada">
        <span className="text-body-sm text-muted-foreground flex items-center gap-1">
          <UserCheck className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate max-w-[110px]">{responsable?.responsable_email ?? "—"}</span>
        </span>
      </Hint>
    );
  }

  if (!responsable) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-label gap-1 text-muted-foreground hover:text-foreground"
        onClick={(e) => { e.stopPropagation(); onAsignarResponsable(hallazgo); }}
      >
        <UserPlus className="h-3.5 w-3.5" /> Asignar
      </Button>
    );
  }

  const vencida = esVencida(revision?.fecha_limite ?? null);

  return (
    <Hint label={tituloAsignacion(responsable)}>
      <Button
        variant="link"
        size="sm"
        className={cn(
          "h-auto p-0 flex items-center gap-1 text-left justify-start",
          responsable.responsable_id === currentUserId ? "text-primary font-medium" : "text-foreground",
        )}
        onClick={(e) => { e.stopPropagation(); onAsignarResponsable(hallazgo); }}
      >
        <UserCheck className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate max-w-[110px]">{responsable.responsable_email}</span>
        {vencida && <AlertTriangle className="h-3 w-3 text-destructive shrink-0" aria-label="Vencido" />}
      </Button>
    </Hint>
  );
}
