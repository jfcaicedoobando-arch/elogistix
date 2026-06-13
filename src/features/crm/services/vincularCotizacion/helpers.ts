/**
 * Helpers compartidos del módulo `vincularCotizacion`.
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchEtapasPipelineActivas } from "@/features/crm/services/etapas";

export interface AuthLite { id?: string; email?: string }

export interface ProspectoData {
  empresa: string;
  contacto: string;
  email: string;
  telefono: string;
}

export function buildOpNombre(empresa: string, folio?: string): string {
  return folio ? `${empresa} — ${folio}` : `Cotización · ${empresa}`;
}

/**
 * Busca la etapa "Cotizando" (abierta, segunda en orden por convención) o
 * la primera abierta como fallback.
 */
export async function resolveEtapaCotizandoId(): Promise<{ id: string; probabilidad: number } | null> {
  const etapas = await fetchEtapasPipelineActivas();
  const abiertas = etapas.filter((e) => e.tipo === "abierta");
  if (abiertas.length === 0) return null;
  const cotizando =
    abiertas.find((e) => e.nombre.toLowerCase().includes("cotiz")) ?? abiertas[0];
  return { id: cotizando.id, probabilidad: cotizando.probabilidad_default ?? 30 };
}

export async function setCotizacionOportunidad(cotizacionId: string, oportunidadId: string) {
  const { error } = await supabase
    .from("cotizaciones")
    .update({ oportunidad_id: oportunidadId })
    .eq("id", cotizacionId);
  if (error) throw error;
}
