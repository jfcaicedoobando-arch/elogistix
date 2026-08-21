import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TabsContent } from "@/components/ui/tabs";
import type { useMarcarRevisadoController } from "@/features/auditoria/hooks";
import type { AuditoriaRevision } from "@/features/auditoria/types";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { MessageSquare, MessageSquareOff } from "lucide-react";
import { formatFechaHora } from "@/lib/formatters";

interface Props {
  ctrl: ReturnType<typeof useMarcarRevisadoController>;
  revisionExistente: AuditoriaRevision | null;
}

export function ComentariosTab({ ctrl, revisionExistente }: Props) {
  return (
    <TabsContent value="comentarios" className="space-y-3 mt-2">
      {!revisionExistente ? (
        <EmptyStateInline
          icon={MessageSquareOff}
          message="Primero asigna o marca el hallazgo para abrir un hilo de comentarios."
          className="py-6"
        />
      ) : (
        <>
          <div className="h-48 overflow-y-auto border rounded-md p-2">
            {ctrl.loadingComentarios ? (
              <EmptyStateInline loading message="Cargando…" className="py-2" />
            ) : !ctrl.comentarios || ctrl.comentarios.length === 0 ? (
              <EmptyStateInline icon={MessageSquare} message="Aún no hay comentarios." className="py-6" />
            ) : (
              <div className="space-y-2">
                {ctrl.comentarios.map((c) => (
                  <div key={c.id} className="text-body-sm border-b pb-2 last:border-b-0">
                    <div className="flex items-center justify-between gap-2 text-label text-muted-foreground">
                      <span className="font-medium text-foreground">{c.autor_email}</span>
                      <span className="tabular-nums">
                        {formatFechaHora(c.created_at, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}
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
              className="text-body"
            />
            <Button
              size="sm"
              onClick={ctrl.handleAgregarComentario}
              disabled={!ctrl.comentario.trim() || ctrl.agregandoComentario}
              loading={ctrl.agregandoComentario}
            >
              {ctrl.agregandoComentario ? null : "Agregar comentario"}
            </Button>
          </div>
        </>
      )}
    </TabsContent>
  );
}
