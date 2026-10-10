import { supabase } from "@/integrations/supabase/client";
import { buscarProspectoOportunidad } from "@/features/crm/services/prospectoSearch";
import type { ProspectoMatch } from "@/features/crm/services/prospectoSearch";
import { captureAuthOperationScope, AuthOperationChangedError } from "@/lib/auth/authOperationScope";
import { fetchTarifasPricingOrganizacion } from "./tarifasPricingCotizacion";
import type { MetadataRespuestaPricing } from "@/features/cotizacion/domain/respuestaPricing";

export interface ContextoPricingParams {
  organizationId: string;
  oportunidadId: string | null;
  solicitudId: string | null;
  tarifaId: string;
}
export type DestinatarioPricing = { clienteId: string; oportunidadId: string; moneda: string | null; etapaNombre: string; prospecto: ProspectoMatch | null };

async function resolverDestinatario(oportunidadId: string, organizationId: string): Promise<DestinatarioPricing> {
  const { data: op, error } = await supabase.from("crm_oportunidades")
    .select("id, cliente_id, lead_id, moneda, etapa:crm_etapas_pipeline!etapa_id!inner(nombre, tipo, activa, deleted_at)")
    .eq("organization_id", organizationId).eq("etapa.organization_id", organizationId).eq("id", oportunidadId).is("deleted_at", null).eq("etapa.tipo", "abierta")
    .eq("etapa.activa", true).is("etapa.deleted_at", null).maybeSingle();
  if (error) throw error;
  if (!op) throw new Error("La oportunidad ya no es elegible para cotizar.");
  if (!op.cliente_id) {
    // El buscador conserva sus restricciones; primero se valida su lead en el tenant.
    const { data: lead, error: errorLead } = await supabase.from("crm_leads").select("id")
      .eq("organization_id", organizationId).eq("id", op.lead_id ?? "").is("deleted_at", null).maybeSingle();
    if (errorLead) throw errorLead;
    if (!lead) throw new Error("El prospecto de la oportunidad ya no es elegible.");
    const prospecto = await buscarProspectoOportunidad(oportunidadId);
    if (!prospecto || prospecto.leadId !== lead.id) throw new Error("El prospecto de la oportunidad ya no es elegible.");
    return { clienteId: "", oportunidadId: op.id, moneda: op.moneda, etapaNombre: op.etapa.nombre, prospecto };
  }
  const { data: cliente, error: errorCliente } = await supabase.from("clientes")
    .select("id").eq("organization_id", organizationId).eq("id", op.cliente_id).is("deleted_at", null).maybeSingle();
  if (errorCliente) throw errorCliente;
  if (!cliente) throw new Error("La empresa de la oportunidad ya no está disponible.");
  return { clienteId: cliente.id, oportunidadId: op.id, moneda: op.moneda, etapaNombre: op.etapa.nombre, prospecto: null };
}

async function resolverSolicitud({ organizationId, solicitudId, oportunidadId, tarifaId }: ContextoPricingParams): Promise<MetadataRespuestaPricing | null> {
  if (!solicitudId) return null; // Enlaces históricos no infieren una solicitud por tarifa.
  const { data: s, error } = await supabase.from("crm_solicitudes_pricing")
    .select("id, oportunidad_id, tarifa_tarifario_id, incoterm, cantidad, servicio, tipo_carga")
    .eq("organization_id", organizationId).eq("id", solicitudId).eq("estado", "respondida").is("deleted_at", null).maybeSingle();
  if (error) throw error;
  if (!s || s.oportunidad_id !== oportunidadId) throw new Error("La solicitud no corresponde a esta oportunidad o ya no está respondida.");
  if (s.tarifa_tarifario_id !== tarifaId) {
    const { data: ligada, error: errorLigada } = await supabase.from("costeo_tarifas")
      .select("id").eq("organization_id", organizationId).eq("id", tarifaId).eq("solicitud_pricing_id", s.id).maybeSingle();
    if (errorLigada) throw errorLigada;
    if (!ligada) throw new Error("La tarifa no pertenece a la respuesta seleccionada.");
  }
  return s;
}

export async function fetchContextoPricingCotizacion(params: ContextoPricingParams) {
  const scope = captureAuthOperationScope();
  if (!params.organizationId || scope.organizationId !== params.organizationId) throw new AuthOperationChangedError();
  const [tarifas, destinatario, solicitud] = await Promise.all([
    fetchTarifasPricingOrganizacion(params.organizationId, [params.tarifaId]),
    params.oportunidadId ? resolverDestinatario(params.oportunidadId, params.organizationId) : Promise.resolve(null),
    resolverSolicitud(params),
  ]);
  scope.assertCurrent();
  const tarifa = tarifas[0];
  if (!tarifa) throw new Error("La tarifa de Pricing ya no está vigente; elige otra en la ruta.");
  return { organizationId: params.organizationId, tarifa, destinatario, solicitud };
}
