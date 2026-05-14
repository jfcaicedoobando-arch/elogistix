import { Badge } from "@/components/ui/badge";
import { DialogDescription } from "@/components/ui/dialog";
import type { AuditoriaRevision, HallazgoAuditoria } from "@/types/auditoria";

interface Props {
  hallazgo: HallazgoAuditoria;
  revisionExistente: AuditoriaRevision | null;
  snoozeActivo: boolean;
}

export function HallazgoSummary({ hallazgo, revisionExistente, snoozeActivo }: Props) {
  return (
    <DialogDescription className="text-xs space-y-1 pt-1">
      <div>
        <span className="font-medium text-foreground">Expediente:</span>{" "}
        <span className="tabular-nums">{hallazgo.expediente}</span>
      </div>
      <div>
        <span className="font-medium text-foreground">Cliente:</span>{" "}
        {hallazgo.cliente_nombre || "—"}
      </div>
      <div className="text-foreground/80 pt-1">{hallazgo.detalle}</div>
      {hallazgo.documentos_faltantes?.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {hallazgo.documentos_faltantes.map((d) => (
            <Badge key={d} variant="secondary" className="text-[10px] font-normal">
              {d}
            </Badge>
          ))}
        </div>
      )}
      {snoozeActivo && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-2 mt-2 text-warning">
          <div className="font-medium">Silenciado hasta {revisionExistente?.snoozed_until}</div>
          {revisionExistente?.snooze_motivo && (
            <div className="text-muted-foreground mt-0.5">{revisionExistente.snooze_motivo}</div>
          )}
        </div>
      )}
    </DialogDescription>
  );
}
