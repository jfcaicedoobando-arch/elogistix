/**
 * Detalle de una solicitud: datos del solicitante, reloj, opciones y acciones.
 * Pricing agrega opciones y marca "Respondida"; el resto sólo consulta.
 */
import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useAccionSolicitud, useOpcionesPricing } from "@/features/crm/hooks/usePricingCrm";
import { esRolPricing } from "@/features/crm/services/pricing/permisosPricing";
import { ETIQUETA_ESTADO_PRICING, type SolicitudPricingRow } from "@/features/crm/services/pricing/tiposPricing";
import { OpcionPricingEditor } from "./OpcionPricingEditor";
import { RelojPricing } from "./RelojPricing";
import { ResumenSolicitudPricing } from "./ResumenSolicitudPricing";

interface Props { solicitud: SolicitudPricingRow }

export function SolicitudPricingDetalle({ solicitud: s }: Props) {
  const { effectiveRole, user } = useAuth();
  const esPricing = esRolPricing(effectiveRole);
  const { data: opciones = [] } = useOpcionesPricing(s.id);
  const accion = useAccionSolicitud();
  const [agregando, setAgregando] = useState(false);
  const editable = esPricing && s.estado === "enviada";
  const puedeCancelar = (esPricing || s.created_by === user?.id) && (s.estado === "borrador" || s.estado === "enviada");

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <span className="text-h4 font-semibold">{s.folio}</span>
          <Badge variant="outline">{ETIQUETA_ESTADO_PRICING[s.estado] ?? s.estado}</Badge>
          <RelojPricing enviadaAt={s.enviada_at} venceAt={s.vence_at} respondidaAt={s.respondida_at} />
          <div className="ml-auto flex gap-2">
            {puedeCancelar && (
              <Button variant="outline" size="sm" disabled={accion.isPending}
                onClick={() => accion.mutate({ id: s.id, accion: "cancelar" })}>Cancelar solicitud</Button>
            )}
            {editable && (
              <Button size="sm" disabled={accion.isPending || opciones.length === 0}
                title={opciones.length === 0 ? "Agrega al menos una opción" : undefined}
                onClick={() => accion.mutate({ id: s.id, accion: "responder" })}>Marcar respondida</Button>
            )}
          </div>
        </CardContent>
      </Card>
      <ResumenSolicitudPricing solicitud={s} />
      {opciones.map((o) => (
        <OpcionPricingEditor key={o.id} solicitudId={s.id} organizationId={s.organization_id}
          orden={o.orden} opcion={o} editable={editable} />
      ))}
      {opciones.length === 0 && !editable && (
        <p className="text-body-sm text-muted-foreground">Pricing aún no agrega opciones.</p>
      )}
      {editable && (agregando ? (
        <OpcionPricingEditor solicitudId={s.id} organizationId={s.organization_id}
          orden={(opciones.at(-1)?.orden ?? 0) + 1} editable onListo={() => setAgregando(false)} />
      ) : (
        <Button variant="outline" onClick={() => setAgregando(true)}>
          <Plus className="mr-1 h-4 w-4" /> Agregar opción
        </Button>
      ))}
    </div>
  );
}
