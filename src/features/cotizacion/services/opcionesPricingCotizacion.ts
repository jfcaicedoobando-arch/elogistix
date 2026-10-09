/**
 * Respuestas de Pricing disponibles para una cotización nueva: solicitudes
 * respondidas de oportunidades en etapa "En negociación" de la empresa
 * (por oportunidad vinculada o por cliente). Sólo lectura con RLS.
 */
import { supabase } from "@/integrations/supabase/client";
import type { TopTarifaRow } from "@/features/costeo/types";
import { fetchTarifasVigentesPorIds } from "@/features/costeo/services/topTarifas";

export interface OpcionPricingCotizacion {
  solicitudFolio: string;
  oportunidadId: string;
  tarifa: TopTarifaRow;
}

interface FilaSolicitud {
  id: string;
  folio: string | null;
  tarifa_tarifario_id: string | null;
  oportunidad: { id: string; cliente_id: string | null; etapa: { nombre: string } | null } | null;
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export const esEnNegociacion = (nombre: string | null | undefined) => norm(nombre ?? "") === "en negociacion";

export async function fetchOpcionesPricingCotizacion(
  filtro: { oportunidadId?: string; clienteId?: string },
): Promise<OpcionPricingCotizacion[]> {
  if (!filtro.oportunidadId && !filtro.clienteId) return [];
  let q = supabase.from("crm_solicitudes_pricing")
    .select("id, folio, tarifa_tarifario_id, oportunidad:crm_oportunidades!crm_solicitudes_pricing_oportunidad_id_fkey!inner(id, cliente_id, etapa:crm_etapas_pipeline!crm_oportunidades_etapa_id_fkey(nombre))")
    .eq("estado", "respondida").is("deleted_at", null).limit(50);
  q = filtro.oportunidadId ? q.eq("oportunidad_id", filtro.oportunidadId) : q.eq("oportunidad.cliente_id", filtro.clienteId ?? "");
  const { data, error } = await q;
  if (error) throw error;
  const solicitudes = (data ?? []).filter((s) => esEnNegociacion(s.oportunidad?.etapa?.nombre));
  if (solicitudes.length === 0) return [];

  // Respuesta = opción elegida del tarifario + tarifas capturadas por Pricing en la solicitud.
  const { data: ligadas, error: e2 } = await supabase.from("costeo_tarifas")
    .select("id, solicitud_pricing_id").in("solicitud_pricing_id", solicitudes.map((s) => s.id)).limit(200);
  if (e2) throw e2;
  const porTarifa = new Map<string, FilaSolicitud>();
  for (const s of solicitudes) if (s.tarifa_tarifario_id) porTarifa.set(s.tarifa_tarifario_id, s);
  for (const l of ligadas ?? []) {
    const s = solicitudes.find((x) => x.id === l.solicitud_pricing_id);
    if (s) porTarifa.set(l.id, s);
  }
  const tarifas = await fetchTarifasVigentesPorIds([...porTarifa.keys()]);
  return tarifas.map((t) => {
    const s = porTarifa.get(String(t.id));
    return { solicitudFolio: s?.folio ?? "", oportunidadId: s?.oportunidad?.id ?? "", tarifa: t };
  });
}
