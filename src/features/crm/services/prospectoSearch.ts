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

type LeadEmbed = { estado: string; empresa: string | null; contacto: string | null; email: string | null };

type OpHit = {
  id: string;
  nombre: string;
  lead_id: string | null;
  cliente_nombre: string | null;
  etapa: { nombre: string } | { nombre: string }[] | null;
  lead: LeadEmbed | LeadEmbed[] | null;
};

const OP_SELECT =
  "id, nombre, lead_id, cliente_nombre, etapa:crm_etapas_pipeline!etapa_id!inner(nombre, tipo, activa), lead:crm_leads!lead_id!inner(estado, empresa, contacto, email)";

/** Consulta base de oportunidades elegibles (sin el filtro de texto). */
function opsQueryBase() {
  return supabase
    .from("crm_oportunidades")
    .select(OP_SELECT)
    .is("deleted_at", null)
    .is("cliente_id", null)
    .eq("etapa.tipo", "abierta")
    .eq("etapa.activa", true)
    .is("etapa.deleted_at", null)
    .is("lead.deleted_at", null)
    .in("lead.estado", [...LEAD_ESTADOS_ELEGIBLES])
    .limit(8);
}

function primero<T>(v: T | T[] | null | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : (v ?? undefined);
}

function mapOportunidad(o: OpHit): ProspectoMatch {
  const lead = primero(o.lead);
  return {
    kind: "oportunidad",
    id: o.id,
    empresa: o.cliente_nombre || lead?.empresa || o.nombre,
    contacto: lead?.contacto ?? "",
    email: lead?.email ?? "",
    telefono: "",
    leadId: o.lead_id,
    etapaNombre: primero(o.etapa)?.nombre,
  };
}

export async function buscarProspectos(term: string): Promise<ProspectoMatch[]> {
  const [leadsRes, opsPropiasRes, opsPorLeadRes] = await Promise.all([
    supabase
      .from("crm_leads")
      .select("id, empresa, contacto, email, telefono").is("deleted_at", null)
      .or(orIlike(["empresa", "contacto", "email"], term))
      .in("estado", [...LEAD_ESTADOS_ELEGIBLES])
      .limit(8),
    // Coincidencias por datos propios de la oportunidad.
    opsQueryBase().or(orIlike(["nombre", "cliente_nombre"], term)),
    // Coincidencias por los datos del lead vinculado (empresa/contacto/email):
    // la UI promete buscar por esos campos y la oportunidad suele no tenerlos.
    opsQueryBase().or(orIlike(["empresa", "contacto", "email"], term), {
      referencedTable: "lead",
    }),
  ]);
  if (leadsRes.error) throw leadsRes.error;
  if (opsPropiasRes.error) throw opsPropiasRes.error;
  if (opsPorLeadRes.error) throw opsPorLeadRes.error;

  const hits: ProspectoMatch[] = (leadsRes.data ?? []).map((l) => ({
    kind: "lead" as const,
    id: l.id,
    empresa: l.empresa,
    contacto: l.contacto ?? "",
    email: l.email ?? "",
    telefono: l.telefono ?? "",
  }));
  // SAFE-CAST: los joins `etapa`/`lead` pueden inferirse como objeto o array
  // según la cardinalidad detectada por PostgREST; ambos shapes son válidos.
  const ops = [
    ...((opsPropiasRes.data ?? []) as unknown as OpHit[]),
    ...((opsPorLeadRes.data ?? []) as unknown as OpHit[]),
  ];
  const vistos = new Set<string>();
  for (const o of ops) {
    if (vistos.has(o.id)) continue;
    vistos.add(o.id);
    hits.push(mapOportunidad(o));
  }
  return hits;
}
