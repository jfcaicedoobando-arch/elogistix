/**
 * Sección de comentarios dentro de OportunidadDetalle (Sprint D).
 */
import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { crmToast } from "@/features/crm/lib/crmToast";
import { formatRelativo } from "@/lib/date/relativo";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import {
  useComentariosOportunidad,
  useCrearComentarioOportunidad,
} from "@/features/crm/hooks";

interface Props {
  oportunidadId: string;
  canEdit: boolean;
}

export default function ComentariosOportunidad({ oportunidadId, canEdit }: Props) {
  const { data: comentarios = [], isLoading } = useComentariosOportunidad(oportunidadId);
  const crear = useCrearComentarioOportunidad();
  const [texto, setTexto] = useState("");

  const enviar = async () => {
    try {
      await crear.mutateAsync({ oportunidadId, texto });
      setTexto("");
      crmToast.success("Comentario publicado");
    } catch {
      // El hook useCrearComentarioOportunidad ya notifica el error en onError;
      // aquí sólo evitamos que la promesa rechazada quede sin capturar.
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Comentarios internos ({comentarios.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {canEdit && (
          <div className="space-y-2">
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribe una nota interna (visible para el equipo)…"
              rows={2}
              maxLength={1000}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={enviar} disabled={!texto.trim() || crear.isPending} loading={crear.isPending}>
                {!crear.isPending && <Send className="h-4 w-4 mr-1" />}
                Publicar
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <EmptyStateInline loading message="Cargando…" />
        ) : comentarios.length === 0 ? (
          <EmptyStateInline icon={MessageSquare} message="Sin comentarios todavía." />
        ) : (
          <ul className="space-y-2">
            {comentarios.map((c) => (
              <li key={c.id} className="border rounded-md p-2 bg-muted/30">
                <div className="flex justify-between text-body-sm text-muted-foreground mb-1">
                  <span className="font-medium text-foreground">{c.autor_email || "Usuario"}</span>
                  <span>{formatRelativo(c.created_at)}</span>
                </div>
                <p className="text-body whitespace-pre-wrap">{c.texto}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
