/**
 * useCrmSearch — búsqueda rápida de entidades CRM (leads, oportunidades, actividades)
 * para el command palette Cmd+P. Debounced 200ms, limit 6 por tipo.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CrmSearchHit =
  | { kind: "lead"; id: string; title: string; subtitle: string }
  | { kind: "oportunidad"; id: string; title: string; subtitle: string }
  | { kind: "actividad"; id: string; title: string; subtitle: string };

export function useCrmSearch(term: string) {
  const t = term.trim();
  return useQuery<CrmSearchHit[]>({
    queryKey: ["crm", "search", t],
    enabled: t.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const like = `%${t}%`;
      const [leadsRes, opsRes, actsRes] = await Promise.all([
        supabase.from("crm_leads").select("id, empresa, contacto, email").ilike("empresa", like).limit(6),
        supabase.from("crm_oportunidades").select("id, nombre, cliente_nombre").or(`nombre.ilike.${like},cliente_nombre.ilike.${like}`).limit(6),
        supabase.from("crm_actividades").select("id, asunto, entidad_tipo, entidad_id").ilike("asunto", like).is("fecha_completada", null).limit(6),
      ]);
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
    },
  });
}
