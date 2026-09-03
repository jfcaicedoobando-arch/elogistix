/**
 * I/O puro: búsqueda combinada de leads + oportunidades del CRM para
 * vincular un prospecto desde el wizard de cotizaciones.
 *
 * Extraído del hook `useCrmProspectoSearch` para mantener los hooks libres
 * de imports directos a Supabase (regla de capas).
 *
 * P0 (cotizaciones huérfanas): sólo se ofrecen orígenes elegibles, los mismos
 * que acepta la RPC `crm_vincular_cotizacion`:
 * - Leads en estado `Calificado` o `Prospecto` (nunca Nuevo/Contactado/
 *   Descalificado/Pendiente de alta/Convertido).
 * - Oportunidades vivas, sin cliente, con etapa activa de tipo `abierta` y
 *   ligadas a un lead elegible. La organización la acota RLS.
 */
import { supabase } from "@/integrations/supabase/client";
import { orIlike } from "@/lib/search/ilike";

/** Estados de lead que pueden originar una cotización de prospecto. */
export const LEAD_ESTADOS_ELEGIBLES = ["Calificado", "Prospecto"] as const;

export interface ProspectoMatch {
  kind: "lead" | "oportunidad";
  id: string;
  empresa: string;
  contacto: string;
  email: string;
  telefono: string;
  leadId?: string | null;
  etapaNombre?: string;
}

type OpHit = {
  id: string;
  nombre: string;
  lead_id: string | null;
  cliente_nombre: string | null;
  etapa: { nombre: string } | { nombre: string }[] | null;
};

export async function buscarProspectos(term: string): Promise<ProspectoMatch[]> {
  const [leadsRes, opsRes] = await Promise.all([
    supabase
      .from("crm_leads")
      .select("id, empresa, contacto, email, telefono").is("deleted_at", null)
      .or(orIlike(["empresa", "contacto", "email"], term))
      .in("estado", [...LEAD_ESTADOS_ELEGIBLES])
      .limit(8),
    supabase
      .from("crm_oportunidades")
      .select(
        "id, nombre, lead_id, cliente_nombre, etapa:crm_etapas_pipeline!etapa_id!inner(nombre, tipo, activa), lead:crm_leads!lead_id!inner(estado)",
      ).is("deleted_at", null)
      .or(orIlike(["nombre", "cliente_nombre"], term))
      .is("cliente_id", null)
      .eq("etapa.tipo", "abierta")
      .eq("etapa.activa", true)
      .is("etapa.deleted_at", null)
      .is("lead.deleted_at", null)
      .in("lead.estado", [...LEAD_ESTADOS_ELEGIBLES])
      .limit(8),

  ]);
  if (leadsRes.error) throw leadsRes.error;
  if (opsRes.error) throw opsRes.error;

  const hits: ProspectoMatch[] = [];
  for (const l of leadsRes.data ?? []) {
    hits.push({
      kind: "lead",
      id: l.id,
      empresa: l.empresa,
      contacto: l.contacto ?? "",
      email: l.email ?? "",
      telefono: l.telefono ?? "",
    });
  }
  // SAFE-CAST: el join `etapa:crm_etapas_pipeline` puede inferirse como objeto o array
  // según la cardinalidad detectada por PostgREST; ambos shapes son válidos en runtime.
  for (const o of (opsRes.data ?? []) as unknown as OpHit[]) {
    const etapaNombre = Array.isArray(o.etapa) ? o.etapa[0]?.nombre : o.etapa?.nombre;
    hits.push({
      kind: "oportunidad",
      id: o.id,
      empresa: o.cliente_nombre || o.nombre,
      contacto: "",
      email: "",
      telefono: "",
      leadId: o.lead_id,
      etapaNombre,
    });
  }
  return hits;
}
