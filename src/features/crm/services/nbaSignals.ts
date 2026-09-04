/**
 * Servicio CRM — señales para Next Best Actions
 * (leads sin contactar > 24h y oportunidades abiertas).
 */
import { supabase } from "@/integrations/supabase/client";
import { filtroVendedor } from "./scopePersonal";

export interface NbaSignals {
  leadsSinContactar: { id: string; empresa: string; created_at: string }[];
  oportunidadesAbiertas: {
    id: string;
    nombre: string;
    fecha_estimada_cierre: string | null;
    updated_at: string;
  }[];
}

/**
 * Tanda 2 · hallazgo 1: NBA es una lista personal ("qué hago yo ahora"), así
 * que ambas señales se limitan al vendedor autenticado. Sin sesión resuelta
 * falla cerrado (listas vacías) en vez de mostrar la cartera del equipo.
 */
export async function fetchNbaSignals(
  userId?: string | null,
  userEmail?: string | null,
): Promise<NbaSignals> {
  if (!userId) return { leadsSinContactar: [], oportunidadesAbiertas: [] };
  const hace24h = new Date();
  hace24h.setDate(hace24h.getDate() - 1);
  const mio = filtroVendedor(userId, userEmail);
  const [leadsQ, opsQ] = await Promise.all([
    supabase
      .from("crm_leads")
      .select("id, empresa, created_at")
      .eq("estado", "Nuevo")
      .is("deleted_at", null)
      .or(mio)
      .lte("created_at", hace24h.toISOString())
      .order("created_at", { ascending: true })
      .limit(20),
    supabase
      .from("crm_oportunidades")
      .select("id, nombre, fecha_estimada_cierre, updated_at, crm_etapas_pipeline!inner(tipo)")
      .eq("crm_etapas_pipeline.tipo", "abierta")
      .is("deleted_at", null)
      .or(mio)
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
