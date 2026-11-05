/**
 * Cambios del gerente de operaciones sobre complejidad y plazo (sólo por RPC).
 */
import { supabase } from "@/integrations/supabase/client";

export async function cambiarComplejidad(id: string, complejidad: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc("crm_pricing_cambiar_complejidad", { p_id: id, p_complejidad: complejidad, p_motivo: motivo });
  if (error) throw error;
}

export async function ampliarPlazo(id: string, horas: number, motivo: string): Promise<void> {
  const { error } = await supabase.rpc("crm_pricing_ampliar_plazo", { p_id: id, p_horas: horas, p_motivo: motivo });
  if (error) throw error;
}

/** Ventana de 8 h desde el envío para ampliar el plazo de una solicitud especial. */
export function puedeAmpliarPlazo(s: { estado: string; complejidad: string; enviada_at: string | null }, ahora: Date): boolean {
  if (s.estado !== "enviada" || s.complejidad !== "alta" || !s.enviada_at) return false;
  return ahora.getTime() <= new Date(s.enviada_at).getTime() + 8 * 3_600_000;
}

const ROLES_GERENTE_OPS = new Set(["gerente_operaciones", "admin_org", "admin", "super_admin"]);
export const esGerenteOps = (role: string | null | undefined) => !!role && ROLES_GERENTE_OPS.has(role);
