/**
 * Búsqueda combinada de leads + oportunidades para vincular desde el wizard
 * de cotizaciones. Reutiliza ilike paralelo, debounced en el caller.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProspectoMatch {
  kind: "lead" | "oportunidad";
  id: string;
  empresa: string;
  contacto: string;
  email: string;
  telefono: string;
  // Para oportunidades:
  leadId?: string | null;
  etapaNombre?: string;
}

async function buscarProspectos(term: string): Promise<ProspectoMatch[]> {
  const like = `%${term}%`;
  const [leadsRes, opsRes] = await Promise.all([
    supabase
      .from("crm_leads")
      .select("id, empresa, contacto, email, telefono")
      .or(`empresa.ilike.${like},contacto.ilike.${like},email.ilike.${like}`)
      .neq("estado", "Convertido")
      .limit(8),
    supabase
      .from("crm_oportunidades")
      .select("id, nombre, lead_id, cliente_nombre, etapa:crm_etapas_pipeline!etapa_id(nombre)")
      .or(`nombre.ilike.${like},cliente_nombre.ilike.${like}`)
      .is("cliente_id", null)
      .limit(8),
  ]);

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
  type OpHit = {
    id: string;
    nombre: string;
    lead_id: string | null;
    cliente_nombre: string | null;
    etapa: { nombre: string } | { nombre: string }[] | null;
  };
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

export function useCrmProspectoSearch(term: string) {
  const t = term.trim();
  return useQuery<ProspectoMatch[]>({
    queryKey: ["crm", "prospecto-search", t],
    enabled: t.length >= 2,
    staleTime: 30_000,
    queryFn: () => buscarProspectos(t),
  });
}
