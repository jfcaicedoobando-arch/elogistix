/**
 * Consulta puntual del borrador sustituto (estado + uuid_fiscal) usada por
 * el wizard de sustitución CFDI. Extraído de `useSustitucionState.ts`
 * (Block 1.6) para que el hook no importe el cliente Supabase directamente.
 */
import { supabase } from "@/integrations/supabase/client";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";

export interface SustitutaEstado {
  id: string;
  estado: string | null;
  uuid_fiscal: string | null;
}

export async function fetchSustitutaEstado(
  facturaId: string,
): Promise<SustitutaEstado | null> {
  const scope = captureAuthOperationScope();
  let query = supabase
    .from("facturas")
    .select("id, estado, uuid_fiscal")
    .eq("id", facturaId).is("deleted_at", null);
  if (scope.organizationId) query = query.eq("organization_id", scope.organizationId);
  const { data, error } = await query.maybeSingle();
  scope.assertCurrent();
  if (error) throw error;
  return data;
}
