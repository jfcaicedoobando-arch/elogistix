/** Respuestas vigentes de solicitudes respondidas en negociación; sólo lectura con RLS. */
import { supabase } from "@/integrations/supabase/client";
import type { TopTarifaRow } from "@/features/costeo/types";
import type { MetadataRespuestaPricing } from "@/features/cotizacion/domain/respuestaPricing";
import { fetchTarifasPricingOrganizacion } from "./tarifasPricingCotizacion";
import { captureAuthOperationScope, AuthOperationChangedError } from "@/lib/auth/authOperationScope";
import { CAP_LOTES_DURO } from "@/constants/queryCaps";
import { ResultadoTruncadoError } from "@/lib/supabase/assertNotTruncated";
import { leerTodasLasPaginas } from "@/lib/supabase/paginado";

export interface OpcionPricingCotizacion extends MetadataRespuestaPricing {
  organizationId: string;
  solicitudId: string;
  solicitudFolio: string;
  oportunidadId: string;
  clienteId: string | null;
  tarifa: TopTarifaRow;
}
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export const esEnNegociacion = (nombre: string | null | undefined) => norm(nombre ?? "") === "en negociacion";

async function leerSolicitudes(filtro: { organizationId: string; oportunidadId?: string; clienteId?: string }) {
  return leerTodasLasPaginas("opciones de Pricing", (desde, hasta) => {
    let q = supabase.from("crm_solicitudes_pricing")
      .select("id, folio, tarifa_tarifario_id, incoterm, cantidad, servicio, tipo_carga, oportunidad:crm_oportunidades!crm_solicitudes_pricing_oportunidad_id_fkey!inner(id, cliente_id, etapa:crm_etapas_pipeline!crm_oportunidades_etapa_id_fkey(nombre))")
      .eq("organization_id", filtro.organizationId).eq("oportunidad.organization_id", filtro.organizationId)
      .eq("oportunidad.etapa.organization_id", filtro.organizationId).eq("oportunidad.etapa.activa", true).eq("oportunidad.etapa.tipo", "abierta")
      .is("oportunidad.etapa.deleted_at", null).eq("estado", "respondida").is("deleted_at", null).is("oportunidad.deleted_at", null);
    if (filtro.oportunidadId) q = q.eq("oportunidad_id", filtro.oportunidadId);
    if (filtro.clienteId) q = q.eq("oportunidad.cliente_id", filtro.clienteId);
    return q.order("id").range(desde, hasta);
  });
}

async function leerLigadas(ids: string[], organizationId: string) {
  const ligadas: { id: string; solicitud_pricing_id: string | null }[] = [];
  for (let offset = 0; offset < ids.length; offset += 200) {
    const lote = ids.slice(offset, offset + 200);
    ligadas.push(...await leerTodasLasPaginas("tarifas de solicitudes Pricing", (desde, hasta) =>
      supabase.from("costeo_tarifas").select("id, solicitud_pricing_id")
        .eq("organization_id", organizationId).in("solicitud_pricing_id", lote).order("id").range(desde, hasta)));
    if (ligadas.length >= CAP_LOTES_DURO) throw new ResultadoTruncadoError("tarifas de solicitudes Pricing", CAP_LOTES_DURO);
  }
  return ligadas;
}

export async function fetchOpcionesPricingCotizacion(filtro: { organizationId: string; oportunidadId?: string; clienteId?: string }): Promise<OpcionPricingCotizacion[]> {
  const scope = captureAuthOperationScope();
  if (!filtro.organizationId || scope.organizationId !== filtro.organizationId) throw new AuthOperationChangedError();
  if (!filtro.oportunidadId && !filtro.clienteId) return [];
  const solicitudes = (await leerSolicitudes(filtro)).filter((s) => esEnNegociacion(s.oportunidad?.etapa?.nombre));
  scope.assertCurrent();
  if (solicitudes.length === 0) return [];
  const ligadas = await leerLigadas(solicitudes.map((s) => s.id), filtro.organizationId);
  const pares = solicitudes.flatMap((s) => {
    const ids = new Set(ligadas.filter((l) => l.solicitud_pricing_id === s.id).map((l) => l.id));
    if (s.tarifa_tarifario_id) ids.add(s.tarifa_tarifario_id);
    return [...ids].map((tarifaId) => ({ s, tarifaId }));
  });
  const tarifas = await fetchTarifasPricingOrganizacion(filtro.organizationId, pares.map((p) => p.tarifaId));
  scope.assertCurrent();
  const porId = new Map(tarifas.map((t) => [t.id, t]));
  return pares.flatMap(({ s, tarifaId }) => {
    const tarifa = porId.get(tarifaId);
    if (!tarifa) return [];
    return [{ organizationId: filtro.organizationId, solicitudId: s.id, solicitudFolio: s.folio, oportunidadId: s.oportunidad.id,
      clienteId: s.oportunidad.cliente_id, incoterm: s.incoterm, cantidad: s.cantidad,
      servicio: s.servicio, tipo_carga: s.tipo_carga, tarifa }];
  });
}
