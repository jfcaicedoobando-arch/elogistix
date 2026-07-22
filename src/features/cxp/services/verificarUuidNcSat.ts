/**
 * Servicio cliente para verificar el estatus SAT de una nota de crédito de
 * proveedor. Llama a la edge function `verificar-uuid-sat` con tipo `cxp_nc`.
 */
import { supabase } from "@/integrations/supabase/client";
import type { EstatusSat, VerificarUuidResult } from "./verificarUuidSat";

export type { EstatusSat, VerificarUuidResult };

export async function verificarUuidNcSat(ncId: string): Promise<VerificarUuidResult> {
  const { data, error } = await supabase.functions.invoke<VerificarUuidResult & { error?: string; detail?: string }>(
    "verificar-uuid-sat",
    { body: { nc_id: ncId, tipo: "cxp_nc" } },
  );
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.detail ?? data.error);
  return data as VerificarUuidResult;
}
