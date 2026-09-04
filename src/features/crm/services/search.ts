/**
 * Servicio CRM — búsqueda rápida (leads, oportunidades, actividades).
 */
import { supabase } from "@/integrations/supabase/client";
import { ilikePattern, orIlike } from "@/lib/search/ilike";
import { CRM_ACTIVIDADES_COLUMNS_SEARCH } from "./crmActividadesColumns";

export type CrmSearchHit =
  | { kind: "lead"; id: string; title: string; subtitle: string }
  | { kind: "oportunidad"; id: string; title: string; subtitle: string }
  | { kind: "actividad"; id: string; title: string; subtitle: string };

export async function searchCrm(term: string): Promise<CrmSearchHit[]> {
  const like = ilikePattern(term);
  const [leadsRes, opsRes, actsRes] = await Promise.all([
    // EC-15: la UX promete buscar leads por empresa, contacto o email
    // (igual que el listado); antes sólo filtraba `empresa`.
    supabase
      .from("crm_leads")
      .select("id, empresa, contacto, email")
      .or(orIlike(["empresa", "contacto", "email"], term))
      .is("deleted_at", null)
      .limit(6),
    supabase
      .from("crm_oportunidades")
      .select("id, nombre, cliente_nombre")
      .or(orIlike(["nombre", "cliente_nombre"], term))
      .is("deleted_at", null)
      .limit(6),
    supabase
      .from("crm_actividades")
      .select(CRM_ACTIVIDADES_COLUMNS_SEARCH)
      .ilike("asunto", like)
      .is("fecha_completada", null)
      .is("deleted_at", null)
      .limit(6),
  ]);
  // EC-14: propagar errores de sub-consultas; antes un fallo (RLS, red,
  // timeout) se veía como "sin resultados" y el usuario duplicaba registros.
  // GlobalSearch ya muestra su estado de fallo (`busquedaFallo`) al lanzar.
  if (leadsRes.error) throw leadsRes.error;
  if (opsRes.error) throw opsRes.error;
  if (actsRes.error) throw actsRes.error;
  const hits: CrmSearchHit[] = [];
  for (const l of leadsRes.data ?? []) {
    hits.push({ kind: "lead", id: l.id, title: l.empresa, subtitle: l.contacto || l.email || "Lead" });
  }
  for (const o of opsRes.data ?? []) {
    hits.push({ kind: "oportunidad", id: o.id, title: o.nombre, subtitle: o.cliente_nombre || "Sin cliente" });
  }
  for (const a of actsRes.data ?? []) {
    hits.push({ kind: "actividad", id: a.id, title: a.asunto, subtitle: `${a.entidad_tipo}` });
  }
  return hits;
}
