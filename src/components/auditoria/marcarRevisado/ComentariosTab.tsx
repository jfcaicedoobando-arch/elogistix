import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TabsContent } from "@/components/ui/tabs";
import type { useMarcarRevisadoController } from "@/hooks/auditoria";
import type { AuditoriaRevision } from "@/types/auditoria";

interface Props {
  ctrl: ReturnType<typeof useMarcarRevisadoController>;
  revisionExistente: AuditoriaRevision | null;
}

export function ComentariosTab({ ctrl, revisionExistente }: Props) {
  return (
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
  );
}
