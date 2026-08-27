/**
 * Oportunidades de un prospecto (lead calificado) — Fase 2 rediseño CRM.
 * Lectura acotada para la tarjeta de la ficha del prospecto.
 */
import { supabase } from "@/integrations/supabase/client";

export interface OportunidadDeProspecto {
  id: string;
  nombre: string;
  monto_estimado: number | null;
  moneda: string | null;
  probabilidad: number | null;
  fecha_estimada_cierre: string | null;
  etapa_nombre: string | null;
}

interface Fila {
  id: string;
  nombre: string;
  monto_estimado: number | null;
  moneda: string | null;
  probabilidad: number | null;
  fecha_estimada_cierre: string | null;
  etapa: { nombre: string } | { nombre: string }[] | null;
}

function etapaNombre(etapa: Fila["etapa"]): string | null {
  if (!etapa) return null;
  return Array.isArray(etapa) ? (etapa[0]?.nombre ?? null) : etapa.nombre;
}

export async function listOportunidadesPorLead(
  leadId: string,
): Promise<OportunidadDeProspecto[]> {
  const { data, error } = await supabase
    .from("crm_oportunidades")
    .select(
      "id, nombre, monto_estimado, moneda, probabilidad, fecha_estimada_cierre, etapa:crm_etapas_pipeline!etapa_id(nombre)",
    )
    .eq("lead_id", leadId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  // SAFE-CAST: shape del select explícito, no inferido por Supabase.
  return ((data ?? []) as unknown as Fila[]).map((o) => ({
    id: o.id,
    nombre: o.nombre,
    monto_estimado: o.monto_estimado,
    moneda: o.moneda,
    probabilidad: o.probabilidad,
    fecha_estimada_cierre: o.fecha_estimada_cierre,
    etapa_nombre: etapaNombre(o.etapa),
  }));
}
