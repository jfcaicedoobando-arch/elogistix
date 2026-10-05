/**
 * Archivos y capturas de una Solicitud a Pricing. Los ve quien solicita y
 * quien responde (misma organización); se puede adjuntar mientras no esté cancelada.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { listarAdjuntos, subirAdjunto, urlAdjunto, type AdjuntoPricing } from "@/features/crm/services/pricing/adjuntosPricing";
import { SelectorAdjuntos } from "./SelectorAdjuntos";

interface Props { organizationId: string; solicitudId: string; puedeAdjuntar: boolean }

const kb = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function Miniatura({ a }: { a: AdjuntoPricing }) {
  const { data: url } = useQuery({ queryKey: ["crm", "pricing", "adjunto-url", a.path], queryFn: () => urlAdjunto(a.path), staleTime: 50 * 60_000 });
  return (
    <a href={url} target="_blank" rel="noreferrer" title={a.nombre}
      className="group flex w-36 flex-col gap-1 rounded-md border border-border p-2 text-xs hover:bg-muted">
      {a.esImagen && url
        ? <img src={url} alt={a.nombre} className="h-24 w-full rounded object-cover" loading="lazy" />
        : <div className="flex h-24 items-center justify-center rounded bg-muted"><FileText className="h-8 w-8 text-muted-foreground" /></div>}
      <span className="truncate font-medium text-foreground">{a.nombre}</span>
      <span className="text-muted-foreground">{kb(a.tamano)}</span>
    </a>
  );
}

export function AdjuntosSolicitudPricing({ organizationId, solicitudId, puedeAdjuntar }: Props) {
  const qc = useQueryClient();
  const key = ["crm", "pricing", "adjuntos", solicitudId];
  const { data: adjuntos = [], isLoading, error } = useQuery({ queryKey: key, queryFn: () => listarAdjuntos(organizationId, solicitudId) });
  const subir = useMutation({
    mutationFn: async (files: File[]) => { for (const f of files) await subirAdjunto(organizationId, solicitudId, f); },
    onSuccess: (_d, files) => notifySuccess(undefined, { title: files.length === 1 ? "Archivo adjuntado" : `${files.length} archivos adjuntados` }),
    onError: (e) => notifyError(undefined, { title: "No se pudo adjuntar el archivo", description: e instanceof Error ? e.message : undefined, error: e, method: "CRM_PRICING_ADJUNTO" }),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Archivos adjuntos</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {puedeAdjuntar && <SelectorAdjuntos disabled={subir.isPending} onArchivos={(f) => f.length && subir.mutate(f)} />}
        {subir.isPending && <p className="text-sm text-muted-foreground">Subiendo…</p>}
        {error && <p className="text-sm text-destructive">No se pudieron cargar los archivos.</p>}
        {!isLoading && !error && adjuntos.length === 0 && <p className="text-sm text-muted-foreground">Sin archivos adjuntos.</p>}
        <div className="flex flex-wrap gap-3">{adjuntos.map((a) => <Miniatura key={a.path} a={a} />)}</div>
      </CardContent>
    </Card>
  );
}
