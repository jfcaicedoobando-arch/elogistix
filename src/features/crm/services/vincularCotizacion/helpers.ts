/**
 * Helpers compartidos del módulo `vincularCotizacion`.
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchEtapasPipelineActivas } from "@/features/crm/services/etapas";
import { registrarActividad } from "@/services/bitacora/registrar";

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
 * Deduplicación de prospectos: busca un lead vivo del tenant con el mismo
 * email (case-insensitive) para reutilizarlo en lugar de crear un duplicado.
 * Devuelve `null` si no hay email o no existe coincidencia.
 */
export async function findLeadIdByEmail(email: string): Promise<string | null> {
  const normalizado = email.trim().toLowerCase();
  if (!normalizado) return null;
  const { data, error } = await supabase
    .from("crm_leads")
    .select("id")
    .ilike("email", normalizado)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
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
  await registrarActividad({
    modulo: "crm",
    accion: "vincular_cotizacion_oportunidad",
    entidadId: oportunidadId,
    detalles: { cotizacion_id: cotizacionId },
  });
}
