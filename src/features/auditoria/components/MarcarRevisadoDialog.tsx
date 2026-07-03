/**
 * Diálogo "Atender hallazgo": shell delgado que orquesta tabs y footer.
 * Lógica en `useMarcarRevisadoController`; UI dividida en marcarRevisado/*.
 * Migrado a FormDialogShell (v13.152.0 — Oleada 3).
 */
import { CalendarOff, CheckCircle2, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useMarcarRevisadoController } from "@/features/auditoria/hooks";
import { HallazgoSummary } from "@/features/auditoria/components/marcarRevisado/HallazgoSummary";
import { AccionTab, AccionButton } from "@/features/auditoria/components/marcarRevisado/AccionTab";
import { ComentariosTab } from "@/features/auditoria/components/marcarRevisado/ComentariosTab";
import { SnoozeTab } from "@/features/auditoria/components/marcarRevisado/SnoozeTab";
import type { AuditoriaRevision, HallazgoAuditoria } from "@/features/auditoria/types";

interface Props {
  hallazgo: HallazgoAuditoria | null;
  revisionExistente: AuditoriaRevision | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarcarRevisadoDialog({ hallazgo, revisionExistente, open, onOpenChange }: Props) {
  const ctrl = useMarcarRevisadoController({
    hallazgo,
    revisionExistente,
    open,
    onClose: () => onOpenChange(false),
  });

  if (!hallazgo) return null;

  const footer = (
    <>
      {ctrl.yaRevisado && (
        <Button
          variant="outline"
          size="sm"
          onClick={ctrl.handleEliminar}
          disabled={ctrl.cargando}
          className="mr-auto text-destructive hover:text-destructive"
        >
          {ctrl.desmarcando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Quitar marca"}
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={ctrl.cargando}>
        Cerrar
      </Button>
      <AccionButton ctrl={ctrl} />
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={CheckCircle2}
      title={ctrl.yaRevisado ? "Hallazgo revisado" : "Atender hallazgo"}
      description="Marcar el hallazgo como revisado, posponerlo o documentar la acción tomada."
      size="xl"
      footer={footer}
    >
      <HallazgoSummary
        hallazgo={hallazgo}
        revisionExistente={revisionExistente}
        snoozeActivo={ctrl.snoozeActivo}
      />

      <Tabs defaultValue="accion" className="space-y-3">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="accion" className="text-xs">
            Acción
          </TabsTrigger>
          <TabsTrigger value="comentarios" className="text-xs" disabled={!revisionExistente}>
            <MessageSquare className="h-3 w-3 mr-1" />
            Comentarios
            {ctrl.comentarios && ctrl.comentarios.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-2xs">
                {ctrl.comentarios.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="snooze" className="text-xs">
            <CalendarOff className="h-3 w-3 mr-1" />
            Snooze
          </TabsTrigger>
        </TabsList>

        <AccionTab ctrl={ctrl} revisionExistente={revisionExistente} />
        <ComentariosTab ctrl={ctrl} revisionExistente={revisionExistente} />
        <SnoozeTab ctrl={ctrl} />
      </Tabs>
    </FormDialogShell>
  );
}
