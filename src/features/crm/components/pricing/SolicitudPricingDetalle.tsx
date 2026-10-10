/**
 * Detalle de una solicitud: datos del solicitante, reloj, respuesta y acciones.
 * La respuesta son tarifas del catálogo ligadas a la solicitud; las opciones
 * capturadas con el formulario anterior se muestran sólo para consulta.
 */
import { useNavigate } from "react-router";
import { useAuth } from "@/lib/contexts/AuthContext";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { useOpcionesPricing } from "@/features/crm/hooks/usePricingCrm";
import { useTarifasRespuestaPricing } from "@/features/crm/hooks/useTarifasRespuestaPricing";
import { esRolPricing, puedeAgregarTarifaRespuesta } from "@/features/crm/services/pricing/permisosPricing";
import type { SolicitudPricingRow } from "@/features/crm/services/pricing/tiposPricing";
import { AccionesSolicitudPricing } from "./AccionesSolicitudPricing";
import { AdjuntosSolicitudPricing } from "./AdjuntosSolicitudPricing";
import { OpcionPricingEditor } from "./OpcionPricingEditor";
import { ResumenSolicitudPricing } from "./ResumenSolicitudPricing";
import { OpcionesTarifario } from "./OpcionesTarifario";
import { TarifasRespuestaPricing } from "./TarifasRespuestaPricing";

interface Props { solicitud: SolicitudPricingRow }

function puedeUsarRespuesta(s: SolicitudPricingRow, userId: string | undefined, esPricing: boolean) {
  return esPricing || s.created_by === userId || s.solicitante_id === userId;
}

export function SolicitudPricingDetalle({ solicitud: s }: Props) {
  const { effectiveRole, user } = useAuth();
  const { canWriteCotizaciones } = usePermissions();
  const navigate = useNavigate();
  const esPricing = esRolPricing(effectiveRole);
  const { data: opciones = [] } = useOpcionesPricing(s.id);
  const tarifasRespuesta = useTarifasRespuestaPricing(s.id, s.estado === "enviada");
  const editable = esPricing && s.estado === "enviada";
  const abierta = s.estado === "borrador" || s.estado === "enviada";
  const puedeCancelar = abierta && (esPricing || s.created_by === user?.id);
  const puedeElegir = puedeUsarRespuesta(s, user?.id, esPricing);
  const puedeCotizar = s.estado === "respondida" && puedeElegir && canWriteCotizaciones;
  const cotizarRespuesta = (tarifaId: string) => {
    // La tarifa ya responde a esta solicitud; cotizar no vuelve a seleccionarla ni cambia su estado.
    const q = new URLSearchParams({ tarifa: tarifaId, solicitud: s.id });
    if (s.oportunidad_id) q.set("oportunidad", s.oportunidad_id);
    navigate(`/cotizaciones/nueva?${q.toString()}`);
  };

  return (
    <div className="space-y-4">
      <AccionesSolicitudPricing solicitud={s} puedeCancelar={puedeCancelar} puedeResponder={editable}
        numOpciones={opciones.length + (tarifasRespuesta.data?.length ?? 0)} />
      <ResumenSolicitudPricing solicitud={s} />
      <AdjuntosSolicitudPricing organizationId={s.organization_id} solicitudId={s.id}
        puedeAdjuntar={s.estado !== "cancelada"} />
      <OpcionesTarifario solicitud={s} puedeElegir={puedeElegir} />
      {opciones.map((o) => (
        <OpcionPricingEditor key={o.id} solicitudId={s.id} organizationId={s.organization_id}
          orden={o.orden} opcion={o} editable={false} />
      ))}
      <TarifasRespuestaPricing solicitudId={s.id} hayOpcionesViejas={opciones.length > 0}
        tarifas={tarifasRespuesta.data ?? []} isLoading={tarifasRespuesta.isLoading}
        isError={tarifasRespuesta.isError} onSaved={() => { void tarifasRespuesta.refetch(); }}
        onCotizar={puedeCotizar ? cotizarRespuesta : undefined}
        editable={s.estado === "enviada" && puedeAgregarTarifaRespuesta(effectiveRole)} />
    </div>
  );
}
