/**
 * Oportunidades cuya empresa fue eliminada: tienen al menos una empresa ligada
 * y todas sus empresas ligadas están dadas de baja (deleted_at).
 */
import { supabase } from "@/integrations/supabase/client";

export type VinculoEmpresa = { oportunidad_id: string; eliminada: boolean };

export function oportunidadesConEmpresaEliminada(vinculos: VinculoEmpresa[]): Set<string> {
  const activas = new Set(vinculos.filter((v) => !v.eliminada).map((v) => v.oportunidad_id));
  return new Set(vinculos.filter((v) => v.eliminada && !activas.has(v.oportunidad_id)).map((v) => v.oportunidad_id));
}

export async function fetchOportunidadesEmpresaEliminada(): Promise<Set<string>> {
  const { data, error } = await supabase.from("crm_oportunidad_empresa")
    .select("oportunidad_id, crm_empresas!inner(deleted_at)").limit(5000);
  if (error) throw error;
  const filas = (data ?? []) as unknown as { oportunidad_id: string; crm_empresas: { deleted_at: string | null } | null }[];
  return oportunidadesConEmpresaEliminada(
    filas.map((f) => ({ oportunidad_id: f.oportunidad_id, eliminada: Boolean(f.crm_empresas?.deleted_at) })),
  );
}
