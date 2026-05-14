/**
 * Diálogo "Atender hallazgo": acción tomada, hilo de comentarios y snooze.
 * La lógica vive en `useMarcarRevisadoController`.
 */
import { format } from "date-fns";
import { CalendarOff, CheckCircle2, Loader2, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMarcarRevisadoController } from "@/hooks/auditoria/useMarcarRevisadoController";
import type { AuditoriaRevision, HallazgoAuditoria } from "@/types/auditoria";

interface Props {
  hallazgo: HallazgoAuditoria | null;
  revisionExistente: AuditoriaRevision | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarcarRevisadoDialog({
  hallazgo,
  revisionExistente,
  open,
  onOpenChange,
}: Props) {
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
            {ctrl.snoozeActivo && (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-2 mt-2 text-warning">
                <div className="font-medium">
                  Silenciado hasta {revisionExistente?.snoozed_until}
                </div>
                {revisionExistente?.snooze_motivo && (
                  <div className="text-muted-foreground mt-0.5">
                    {revisionExistente.snooze_motivo}
                  </div>
                )}
              </div>
            )}
          </DialogDescription>
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

          {/* ─── Acción ─── */}
          <TabsContent value="accion" className="space-y-2 mt-2">
            <Label htmlFor="accion-tomada" className="text-xs">
              Acción tomada <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="accion-tomada"
              placeholder="Describe la acción tomada para resolver o justificar este hallazgo..."
              value={ctrl.accion}
              onChange={(e) => ctrl.setAccion(e.target.value)}
              rows={4}
              maxLength={1000}
              className="text-sm"
            />
            <div className="text-[10px] text-muted-foreground text-right tabular-nums">
              {ctrl.accion.length} / 1000
            </div>

            {ctrl.yaRevisado && revisionExistente && (
              <div className="rounded-md border bg-muted/40 p-2 text-[11px] space-y-0.5">
                <div>
                  <span className="text-muted-foreground">Revisado por:</span>{" "}
                  <span className="font-medium">{revisionExistente.revisado_por_email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fecha:</span>{" "}
                  <span className="tabular-nums">
                    {format(new Date(revisionExistente.updated_at), "dd/MM/yyyy HH:mm")}
                  </span>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ─── Comentarios ─── */}
          <TabsContent value="comentarios" className="space-y-3 mt-2">
            {!revisionExistente ? (
              <div className="text-xs text-muted-foreground py-6 text-center">
                Primero asigna o marca el hallazgo para abrir un hilo de comentarios.
              </div>
            ) : (
              <>
                <div className="h-48 overflow-y-auto border rounded-md p-2">
                  {ctrl.loadingComentarios ? (
                    <div className="text-xs text-muted-foreground">Cargando…</div>
                  ) : !ctrl.comentarios || ctrl.comentarios.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-6">
                      Aún no hay comentarios.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {ctrl.comentarios.map((c) => (
                        <div key={c.id} className="text-xs border-b pb-2 last:border-b-0">
                          <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                            <span className="font-medium text-foreground">{c.autor_email}</span>
                            <span className="tabular-nums">
                              {format(new Date(c.created_at), "dd/MM HH:mm")}
                            </span>
                          </div>
                          <div className="text-foreground/90 mt-0.5 whitespace-pre-wrap">
                            {c.contenido}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Textarea
                    placeholder="Escribe un comentario para el equipo…"
                    value={ctrl.comentario}
                    onChange={(e) => ctrl.setComentario(e.target.value)}
                    rows={2}
                    maxLength={500}
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={ctrl.handleAgregarComentario}
                    disabled={!ctrl.comentario.trim() || ctrl.agregandoComentario}
                  >
                    {ctrl.agregandoComentario ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Agregar comentario"
                    )}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* ─── Snooze ─── */}
          <TabsContent value="snooze" className="space-y-2 mt-2">
            <p className="text-xs text-muted-foreground">
              Silencia este hallazgo hasta una fecha. Sigue contando como pendiente en histórico,
              pero deja de mostrarse en la tabla por defecto.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="snooze-hasta" className="text-xs">
                  Silenciar hasta <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="snooze-hasta"
                  type="date"
                  min={ctrl.minSnoozeDate}
                  value={ctrl.snoozeHasta}
                  onChange={(e) => ctrl.setSnoozeHasta(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="snooze-motivo" className="text-xs">
                Motivo <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="snooze-motivo"
                placeholder="Por qué se silencia (ej. esperando documentación del cliente)..."
                value={ctrl.snoozeMotivo}
                onChange={(e) => ctrl.setSnoozeMotivo(e.target.value)}
                rows={2}
                maxLength={300}
                className="text-sm"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={ctrl.handleSnooze}
                disabled={!ctrl.snoozeHasta || !ctrl.snoozeMotivo.trim() || ctrl.snoozeando}
              >
                {ctrl.snoozeando ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Silenciar"
                )}
              </Button>
              {ctrl.snoozeActivo && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={ctrl.handleQuitarSnooze}
                  disabled={ctrl.cargando}
                >
                  Quitar snooze
                </Button>
              )}
            </div>
          </TabsContent>
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
              {ctrl.desmarcando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Quitar marca"
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={ctrl.cargando}
          >
            Cerrar
          </Button>
          <Button
            size="sm"
            onClick={ctrl.handleGuardar}
            disabled={ctrl.cargando || !ctrl.accion.trim()}
          >
            {ctrl.marcando ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Guardando...
              </>
            ) : ctrl.yaRevisado ? (
              "Actualizar"
            ) : (
              "Marcar como revisado"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
