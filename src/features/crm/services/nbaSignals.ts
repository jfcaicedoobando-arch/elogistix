/**
 * Servicio CRM — señales para Next Best Actions
 * (leads sin contactar > 24h y oportunidades abiertas).
 */
import { supabase } from "@/integrations/supabase/client";

export interface NbaSignals {
  leadsSinContactar: { id: string; empresa: string; created_at: string }[];
  oportunidadesAbiertas: {
    id: string;
    nombre: string;
    fecha_estimada_cierre: string | null;
    updated_at: string;
  }[];
}

export async function fetchNbaSignals(): Promise<NbaSignals> {
  const hace24h = new Date();
  hace24h.setDate(hace24h.getDate() - 1);
  const [leadsQ, opsQ] = await Promise.all([
    supabase
      .from("crm_leads")
      .select("id, empresa, created_at")
      .eq("estado", "Nuevo")
      .lte("created_at", hace24h.toISOString())
      .order("created_at", { ascending: true })
      .limit(20),
    supabase
      .from("crm_oportunidades")
      .select("id, nombre, fecha_estimada_cierre, updated_at, crm_etapas_pipeline!inner(tipo)")
      .eq("crm_etapas_pipeline.tipo", "abierta")
      .order("updated_at", { ascending: true })
      .limit(50),
  ]);
  if (leadsQ.error) throw leadsQ.error;
  if (opsQ.error) throw opsQ.error;
  return {
    leadsSinContactar: leadsQ.data ?? [],
    oportunidadesAbiertas: (opsQ.data ?? []).map((o) => ({
      id: o.id,
      nombre: o.nombre,
      fecha_estimada_cierre: o.fecha_estimada_cierre,
      updated_at: o.updated_at,
    })),
  };
}
