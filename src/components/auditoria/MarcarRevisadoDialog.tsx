import { useEffect, useMemo, useState } from "react";
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

import {
  useDesmarcarRevisado,
  useMarcarRevisado,
} from "@/hooks/auditoria/useAuditoriaRevisiones";
import {
  useAuditoriaComentarios,
  useAgregarComentarioAuditoria,
} from "@/hooks/auditoria/useAuditoriaComentarios";
import {
  useQuitarSnooze,
  useSnoozeHallazgo,
} from "@/hooks/auditoria/useSnoozeHallazgo";
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
  const [accion, setAccion] = useState("");
  const [comentario, setComentario] = useState("");
  const [snoozeHasta, setSnoozeHasta] = useState("");
  const [snoozeMotivo, setSnoozeMotivo] = useState("");

  const marcar = useMarcarRevisado();
  const desmarcar = useDesmarcarRevisado();
  const snooze = useSnoozeHallazgo();
  const quitarSnooze = useQuitarSnooze();
  const agregarComentario = useAgregarComentarioAuditoria();

  const { data: comentarios, isLoading: loadingComentarios } =
    useAuditoriaComentarios(revisionExistente?.id);

  useEffect(() => {
    if (open) {
      setAccion(revisionExistente?.accion_tomada ?? "");
      setComentario("");
      setSnoozeHasta(revisionExistente?.snoozed_until ?? "");
      setSnoozeMotivo(revisionExistente?.snooze_motivo ?? "");
    }
  }, [open, revisionExistente]);

  const minSnoozeDate = useMemo(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return t.toISOString().slice(0, 10);
  }, []);

  if (!hallazgo) return null;

  const yaRevisado = !!revisionExistente && revisionExistente.estado_revision === "revisado";
  const cargando =
    marcar.isPending ||
    desmarcar.isPending ||
    snooze.isPending ||
    quitarSnooze.isPending;

  const handleGuardar = async () => {
    const trimmed = accion.trim();
    if (!trimmed) return;
    await marcar.mutateAsync({ hallazgo, accionTomada: trimmed });
    onOpenChange(false);
  };

  const handleEliminar = async () => {
    if (!revisionExistente) return;
    await desmarcar.mutateAsync(revisionExistente.id);
    onOpenChange(false);
  };

  const handleAgregarComentario = async () => {
    if (!revisionExistente?.id || !comentario.trim()) return;
    await agregarComentario.mutateAsync({
      revisionId: revisionExistente.id,
      contenido: comentario.trim(),
    });
    setComentario("");
  };

  const handleSnooze = async () => {
    if (!snoozeHasta || !snoozeMotivo.trim()) return;
    await snooze.mutateAsync({
      hallazgo,
      snoozedUntil: snoozeHasta,
      motivo: snoozeMotivo.trim(),
    });
    onOpenChange(false);
  };

  const handleQuitarSnooze = async () => {
    if (!revisionExistente?.id) return;
    await quitarSnooze.mutateAsync(revisionExistente.id);
    onOpenChange(false);
  };

  const snoozeActivo =
    !!revisionExistente?.snoozed_until &&
    revisionExistente.snoozed_until >= new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            {yaRevisado ? "Hallazgo revisado" : "Atender hallazgo"}
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
                  <Badge
                    key={d}
                    variant="secondary"
                    className="text-[10px] font-normal"
                  >
                    {d}
                  </Badge>
                ))}
              </div>
            )}
            {snoozeActivo && (
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
            <TabsTrigger
              value="comentarios"
              className="text-xs"
              disabled={!revisionExistente}
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              Comentarios
              {comentarios && comentarios.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                  {comentarios.length}
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
              value={accion}
              onChange={(e) => setAccion(e.target.value)}
              rows={4}
              maxLength={1000}
              className="text-sm"
            />
            <div className="text-[10px] text-muted-foreground text-right tabular-nums">
              {accion.length} / 1000
            </div>

            {yaRevisado && revisionExistente && (
              <div className="rounded-md border bg-muted/40 p-2 text-[11px] space-y-0.5">
                <div>
                  <span className="text-muted-foreground">Revisado por:</span>{" "}
                  <span className="font-medium">
                    {revisionExistente.revisado_por_email}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fecha:</span>{" "}
                  <span className="tabular-nums">
                    {format(
                      new Date(revisionExistente.updated_at),
                      "dd/MM/yyyy HH:mm",
                    )}
                  </span>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ─── Comentarios ─── */}
          <TabsContent value="comentarios" className="space-y-3 mt-2">
            {!revisionExistente ? (
              <div className="text-xs text-muted-foreground py-6 text-center">
                Primero asigna o marca el hallazgo para abrir un hilo de
                comentarios.
              </div>
            ) : (
              <>
                <div className="h-48 overflow-y-auto border rounded-md p-2">
                  {loadingComentarios ? (
                    <div className="text-xs text-muted-foreground">Cargando…</div>
                  ) : !comentarios || comentarios.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-6">
                      Aún no hay comentarios.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {comentarios.map((c) => (
                        <div
                          key={c.id}
                          className="text-xs border-b pb-2 last:border-b-0"
                        >
                          <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {c.autor_email}
                            </span>
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
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    rows={2}
                    maxLength={500}
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={handleAgregarComentario}
                    disabled={
                      !comentario.trim() || agregarComentario.isPending
                    }
                  >
                    {agregarComentario.isPending ? (
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
              Silencia este hallazgo hasta una fecha. Sigue contando como
              pendiente en histórico, pero deja de mostrarse en la tabla por
              defecto.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="snooze-hasta" className="text-xs">
                  Silenciar hasta <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="snooze-hasta"
                  type="date"
                  min={minSnoozeDate}
                  value={snoozeHasta}
                  onChange={(e) => setSnoozeHasta(e.target.value)}
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
                value={snoozeMotivo}
                onChange={(e) => setSnoozeMotivo(e.target.value)}
                rows={2}
                maxLength={300}
                className="text-sm"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleSnooze}
                disabled={
                  !snoozeHasta || !snoozeMotivo.trim() || snooze.isPending
                }
              >
                {snooze.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Silenciar"
                )}
              </Button>
              {snoozeActivo && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleQuitarSnooze}
                  disabled={quitarSnooze.isPending}
                >
                  Quitar snooze
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-2">
          {yaRevisado && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEliminar}
              disabled={cargando}
              className="mr-auto text-destructive hover:text-destructive"
            >
              {desmarcar.isPending ? (
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
            disabled={cargando}
          >
            Cerrar
          </Button>
          <Button
            size="sm"
            onClick={handleGuardar}
            disabled={cargando || !accion.trim()}
          >
            {marcar.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Guardando...
              </>
            ) : yaRevisado ? (
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
