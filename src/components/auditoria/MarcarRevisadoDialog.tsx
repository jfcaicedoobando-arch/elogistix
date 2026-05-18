/**
 * Diálogo "Atender hallazgo": shell delgado que orquesta tabs y footer.
 * Lógica en `useMarcarRevisadoController`; UI dividida en marcarRevisado/*.
 */
import { CalendarOff, CheckCircle2, Loader2, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMarcarRevisadoController } from "@/hooks/auditoria";
import { HallazgoSummary } from "@/components/auditoria/marcarRevisado/HallazgoSummary";
import { AccionTab, AccionButton } from "@/components/auditoria/marcarRevisado/AccionTab";
import { ComentariosTab } from "@/components/auditoria/marcarRevisado/ComentariosTab";
import { SnoozeTab } from "@/components/auditoria/marcarRevisado/SnoozeTab";
import type { AuditoriaRevision, HallazgoAuditoria } from "@/types/auditoria";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            {ctrl.yaRevisado ? "Hallazgo revisado" : "Atender hallazgo"}
          </DialogTitle>
          <HallazgoSummary
            hallazgo={hallazgo}
            revisionExistente={revisionExistente}
            snoozeActivo={ctrl.snoozeActivo}
          />
        </DialogHeader>

        <Tabs defaultValue="accion" className="space-y-3">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="accion" className="text-xs">
              Acción
            </TabsTrigger>
            <TabsTrigger value="comentarios" className="text-xs" disabled={!revisionExistente}>
              <MessageSquare className="h-3 w-3 mr-1" />
              Comentarios
              {ctrl.comentarios && ctrl.comentarios.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
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

        <DialogFooter className="gap-2 sm:gap-2">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
