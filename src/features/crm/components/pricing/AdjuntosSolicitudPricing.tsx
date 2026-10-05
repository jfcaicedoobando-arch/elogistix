/**
 * Archivos y capturas de una Solicitud a Pricing. Los ve quien solicita y
 * quien responde (misma organización); se puede adjuntar mientras no esté cancelada.
 */
import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hint } from "@/components/shared/Hint";
import { useAdjuntosSolicitudPricing, useUrlAdjuntoPricing } from "@/features/crm/hooks/useAdjuntosSolicitudPricing";
import type { AdjuntoPricing } from "@/features/crm/services/pricing/adjuntosPricing";
import { SelectorAdjuntos } from "./SelectorAdjuntos";

interface Props { organizationId: string; solicitudId: string; puedeAdjuntar: boolean }

const kb = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function Miniatura({ a }: { a: AdjuntoPricing }) {
  const { data: url } = useUrlAdjuntoPricing(a.path);
  return (
    <Hint label={a.nombre}>
      <a href={url} target="_blank" rel="noreferrer" aria-label={a.nombre}
        className="group flex w-36 flex-col gap-1 rounded-md border border-border p-2 text-label hover:bg-muted">
        {a.esImagen && url
          ? <img src={url} alt={a.nombre} className="h-24 w-full rounded object-cover" loading="lazy" />
          : <div className="flex h-24 items-center justify-center rounded bg-muted"><FileText className="h-8 w-8 text-muted-foreground" /></div>}
        <span className="truncate font-medium text-foreground">{a.nombre}</span>
        <span className="text-muted-foreground">{kb(a.tamano)}</span>
      </a>
    </Hint>
  );
}

export function AdjuntosSolicitudPricing({ organizationId, solicitudId, puedeAdjuntar }: Props) {
  const { adjuntos, isLoading, error, subir } = useAdjuntosSolicitudPricing(organizationId, solicitudId);

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle>Archivos adjuntos</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {puedeAdjuntar && <SelectorAdjuntos disabled={subir.isPending} onArchivos={(f) => f.length && subir.mutate(f)} />}
        {subir.isPending && <p className="text-body text-muted-foreground">Subiendo…</p>}
        {error && <p className="text-body text-destructive">No se pudieron cargar los archivos.</p>}
        {!isLoading && !error && adjuntos.length === 0 && <p className="text-body text-muted-foreground">Sin archivos adjuntos.</p>}
        <div className="flex flex-wrap gap-3">{adjuntos.map((a) => <Miniatura key={a.path} a={a} />)}</div>
      </CardContent>
    </Card>
  );
}
