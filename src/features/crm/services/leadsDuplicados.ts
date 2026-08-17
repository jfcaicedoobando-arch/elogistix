/**
 * Consulta de leads duplicados vía RPC `crm_leads_buscar_duplicados`
 * (v13.630.0 — Ola A CRM). La RPC ya filtra papelera y tenant.
 */
import { supabase } from "@/integrations/supabase/client";
import type { LeadClave, LeadExistente } from "@/features/crm/domain/leadsDedupe";

const MAX_CLAVES = 500;

export async function buscarLeadsDuplicados(
  claves: ReadonlyArray<LeadClave>,
): Promise<LeadExistente[]> {
  const utiles = claves
    .filter((c) => c.empresa || c.email || c.telefono)
    .slice(0, MAX_CLAVES)
    .map((c) => ({
      empresa: c.empresa ?? "",
      email: c.email ?? "",
      telefono: c.telefono ?? "",
    }));
  if (utiles.length === 0) return [];

  const { data, error } = await supabase.rpc("crm_leads_buscar_duplicados", {
    p_claves: utiles,
  });
  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id,
    empresa: r.empresa,
    contacto: r.contacto,
    email: r.email,
    telefono: r.telefono,
    estado: r.estado,
  }));
}
