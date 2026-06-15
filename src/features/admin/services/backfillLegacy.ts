/**
 * Servicio: ejecuta la RPC `run_auditoria_backfill_legacy` (super_admin only).
 * Aísla el acceso a Supabase para que los componentes/pages no importen el cliente.
 */
import { supabase } from "@/integrations/supabase/client";

export interface BackfillLegacyResult {
  ejecutado_at: string;
  totales: {
    conceptos_actualizados: number;
    embarques_afectados: number;
    proformas_actualizadas: number;
  };
}

export async function runAuditoriaBackfillLegacy(): Promise<BackfillLegacyResult> {
  const { data, error } = await supabase.rpc("run_auditoria_backfill_legacy");
  if (error) throw error;
  // SAFE-CAST: la RPC devuelve un jsonb con la forma documentada en BackfillLegacyResult,
  // validada por contrato del backend (ver migración run_auditoria_backfill_legacy).
  return data as unknown as BackfillLegacyResult;
}
