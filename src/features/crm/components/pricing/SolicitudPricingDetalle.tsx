/**
 * Detalle de una solicitud: datos del solicitante, reloj, opciones y acciones.
 * Pricing agrega opciones y marca "Respondida"; el resto sólo consulta.
 */
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOpcionesPricing } from "@/features/crm/hooks/usePricingCrm";
import { esRolPricing } from "@/features/crm/services/pricing/permisosPricing";
import type { SolicitudPricingRow } from "@/features/crm/services/pricing/tiposPricing";
import { AccionesSolicitudPricing } from "./AccionesSolicitudPricing";
import { OpcionPricingEditor } from "./OpcionPricingEditor";
import { ResumenSolicitudPricing } from "./ResumenSolicitudPricing";

interface Props { solicitud: SolicitudPricingRow }

export function SolicitudPricingDetalle({ solicitud: s }: Props) {
  const { effectiveRole, user } = useAuth();
  const esPricing = esRolPricing(effectiveRole);
  const { data: opciones = [] } = useOpcionesPricing(s.id);
  const [agregando, setAgregando] = useState(false);
  const editable = esPricing && s.estado === "enviada";
  const abierta = s.estado === "borrador" || s.estado === "enviada";
  const puedeCancelar = abierta && (esPricing || s.created_by === user?.id);
  const siguiente = (opciones.at(-1)?.orden ?? 0) + 1;

  return (
    <div className="space-y-4">
      <AccionesSolicitudPricing solicitud={s} puedeCancelar={puedeCancelar} puedeResponder={editable}
        numOpciones={opciones.length} />
      <ResumenSolicitudPricing solicitud={s} />
      {opciones.map((o) => (
        <OpcionPricingEditor key={o.id} solicitudId={s.id} organizationId={s.organization_id}
          orden={o.orden} opcion={o} editable={editable} />
      ))}
      {opciones.length === 0 && !editable && (
        <p className="text-body-sm text-muted-foreground">Pricing aún no agrega opciones.</p>
      )}
      {editable && agregando && (
        <OpcionPricingEditor solicitudId={s.id} organizationId={s.organization_id}
          orden={siguiente} editable onListo={() => setAgregando(false)} />
      )}
      {editable && !agregando && (
        <Button variant="outline" onClick={() => setAgregando(true)}>
          <Plus className="mr-1 h-4 w-4" /> Agregar opción
        </Button>
      )}
    </div>
  );
}
