/**
 * Pestaña "Pricing" de la oportunidad: solicitudes de la oportunidad, alta y detalle.
 */
import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSolicitudesOportunidad } from "@/features/crm/hooks/usePricingCrm";
import { ETIQUETA_ESTADO_PRICING, type SolicitudPricingRow } from "@/features/crm/services/pricing/tiposPricing";
import { RelojPricing } from "./RelojPricing";
import { SolicitudPricingDetalle } from "./SolicitudPricingDetalle";
import { SolicitudPricingDialog } from "./SolicitudPricingDialog";

interface Props { oportunidadId: string; clienteNombre?: string | null; canEdit: boolean }

export function PricingOportunidadTab({ oportunidadId, clienteNombre, canEdit }: Props) {
  const { data: solicitudes = [], isLoading, error } = useSolicitudesOportunidad(oportunidadId);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<{ open: boolean; solicitud: SolicitudPricingRow | null }>({ open: false, solicitud: null });
  const seleccionada = solicitudes.find((s) => s.id === abierta) ?? null;

  if (error) return <p className="text-body-sm text-destructive">No se pudieron cargar las solicitudes.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-body-sm text-muted-foreground">Pide tarifas a Pricing sin salir de la oportunidad.</p>
        {canEdit && (
          <Button size="sm" onClick={() => setDialogo({ open: true, solicitud: null })}>
            <Plus className="mr-1 size-4" /> Nueva solicitud
          </Button>
        )}
      </div>
      {isLoading && <p className="text-body-sm text-muted-foreground">Cargando…</p>}
      {!isLoading && solicitudes.length === 0 && (
        <Card><CardContent className="py-6 text-center text-body-sm text-muted-foreground">Aún no hay solicitudes a Pricing.</CardContent></Card>
      )}
      {solicitudes.map((s) => (
        <button key={s.id} type="button" onClick={() => setAbierta(abierta === s.id ? null : s.id)}
          className="flex w-full flex-wrap items-center gap-3 rounded-lg border bg-card p-3 text-left hover:bg-muted/50">
          <span className="font-medium">{s.folio}</span>
          <Badge variant="outline">{ETIQUETA_ESTADO_PRICING[s.estado] ?? s.estado}</Badge>
          <span className="text-body-sm text-muted-foreground">{[s.servicio, s.origen ?? s.pol, s.destino ?? s.pod].filter(Boolean).join(" · ")}</span>
          <span className="ml-auto"><RelojPricing enviadaAt={s.enviada_at} venceAt={s.vence_at} respondidaAt={s.respondida_at} /></span>
        </button>
      ))}
      {seleccionada && (
        <>
          {seleccionada.estado === "borrador" && canEdit && (
            <Button variant="outline" size="sm" onClick={() => setDialogo({ open: true, solicitud: seleccionada })}>
              Editar borrador
            </Button>
          )}
          <SolicitudPricingDetalle solicitud={seleccionada} />
        </>
      )}
      <SolicitudPricingDialog open={dialogo.open} onOpenChange={(o) => setDialogo((p) => ({ ...p, open: o }))}
        oportunidadId={oportunidadId} clienteNombre={clienteNombre} solicitud={dialogo.solicitud} />
    </div>
  );
}
