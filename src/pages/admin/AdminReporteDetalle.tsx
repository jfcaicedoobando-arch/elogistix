import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Bug, Lightbulb, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  useReporteFeedbackDetalle,
  useReporteFeedbackComentarios,
  useReporteFeedbackMutations,
} from "@/hooks/admin/useReportesFeedback";
import { getImagenSignedUrl } from "@/services/feedback";
import {
  ESTADO_FEEDBACK_LABEL,
  TIPO_FEEDBACK_LABEL,
  type EstadoReporteFeedback,
} from "@/types/feedback";
import { format } from "date-fns";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";

export default function AdminReporteDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: reporte, isLoading } = useReporteFeedbackDetalle(id);
  const { data: comentarios } = useReporteFeedbackComentarios(id);
  const { cambiarEstado, comentar, eliminar } = useReporteFeedbackMutations(id);
  const [nuevoComentario, setNuevoComentario] = useState("");
  const [imagenUrls, setImagenUrls] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!reporte?.imagenes?.length) { setImagenUrls([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const urls = await Promise.all(reporte.imagenes.map((p) => getImagenSignedUrl(p)));
        if (!cancelled) setImagenUrls(urls);
      } catch { /* silencioso */ }
    })();
    return () => { cancelled = true; };
  }, [reporte?.imagenes]);

  if (isLoading || !reporte) {
    return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/reportes")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Volver
        </Button>
        <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-4 w-4 mr-1.5" /> Eliminar
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {reporte.tipo === "bug" ? <Bug className="h-4 w-4 text-destructive" /> : <Lightbulb className="h-4 w-4 text-primary" />}
                    <Badge variant="outline" className="text-[10px]">{TIPO_FEEDBACK_LABEL[reporte.tipo]}</Badge>
                  </div>
                  <CardTitle className="text-xl">{reporte.titulo}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm whitespace-pre-wrap">{reporte.descripcion}</p>

              {reporte.url && (
                <div className="text-xs">
                  <span className="text-muted-foreground">URL: </span>
                  <a href={reporte.url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
                    {reporte.url} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {reporte.elemento_selector && (
                <div className="text-xs space-y-1">
                  <div className="text-muted-foreground">Elemento seleccionado:</div>
                  <code className="block bg-muted rounded px-2 py-1 font-mono text-[11px] break-all">{reporte.elemento_selector}</code>
                  {reporte.elemento_texto && <div className="text-muted-foreground italic">"{reporte.elemento_texto}"</div>}
                </div>
              )}

              {imagenUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {imagenUrls.map((u, i) => (
                    <a key={i} href={u} target="_blank" rel="noreferrer" className="block rounded-md border overflow-hidden aspect-video bg-muted">
                      <img src={u} alt={`Imagen ${i + 1}`} className="h-full w-full object-cover hover:opacity-90 transition" />
                    </a>
                  ))}
                </div>
              )}

              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Metadata técnica</summary>
                <pre className="mt-2 bg-muted rounded p-2 overflow-x-auto text-[10px]">{JSON.stringify(reporte.metadata, null, 2)}</pre>
              </details>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Conversación</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {comentarios && comentarios.length > 0 ? (
                <div className="space-y-3">
                  {comentarios.map((c) => (
                    <div key={c.id} className={`rounded-md p-3 ${c.autor_es_admin ? "bg-primary/5 border border-primary/20" : "bg-muted"}`}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium">{c.autor_email} {c.autor_es_admin && <Badge variant="outline" className="ml-1 text-[9px]">Admin</Badge>}</span>
                        <span className="text-muted-foreground">{format(new Date(c.created_at), "dd/MM/yyyy HH:mm")}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{c.contenido}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Aún no hay comentarios.</p>
              )}
              <Separator />
              <Textarea
                value={nuevoComentario}
                onChange={(e) => setNuevoComentario(e.target.value)}
                placeholder="Responder al usuario..."
                rows={3}
                maxLength={2000}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={!nuevoComentario.trim() || comentar.isPending}
                  onClick={() => comentar.mutate(nuevoComentario.trim(), { onSuccess: () => setNuevoComentario("") })}
                >
                  Enviar respuesta
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Estado</CardTitle></CardHeader>
            <CardContent>
              <Select
                value={reporte.estado}
                onValueChange={(v) => cambiarEstado.mutate(v as EstadoReporteFeedback)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ESTADO_FEEDBACK_LABEL) as EstadoReporteFeedback[]).map((e) => (
                    <SelectItem key={e} value={e}>{ESTADO_FEEDBACK_LABEL[e]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Reportero</CardTitle></CardHeader>
            <CardContent className="text-xs space-y-1.5">
              <div><span className="text-muted-foreground">Email: </span>{reporte.usuario_email}</div>
              <div><span className="text-muted-foreground">Rol: </span>{reporte.rol_reportero ?? "—"}</div>
              <div><span className="text-muted-foreground">Organización: </span>{reporte.organization_id ?? "—"}</div>
              <div><span className="text-muted-foreground">Creado: </span>{format(new Date(reporte.created_at), "dd/MM/yyyy HH:mm")}</div>
              <div><span className="text-muted-foreground">Actualizado: </span>{format(new Date(reporte.updated_at), "dd/MM/yyyy HH:mm")}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <DoubleConfirmDeleteDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        entityName={reporte.titulo}
        description="El reporte y sus comentarios serán eliminados permanentemente."
        finalDescription="Esta acción no se puede deshacer."
        onConfirm={() => eliminar.mutate(undefined, { onSuccess: () => navigate("/admin/reportes") })}
        isPending={eliminar.isPending}
      />
    </div>
  );
}
