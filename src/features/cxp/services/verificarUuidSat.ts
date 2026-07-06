/**
 * Servicio cliente para verificar el estatus de un CFDI en el SAT.
 * Llama a la edge function `verificar-uuid-sat` y devuelve el estatus.
 * v13.195.0
 *
 * α.1 — Soporta ambos flujos:
 *   - "cxp" (default): factura recibida de proveedor (`proveedor_facturas`)
 *   - "cxc":           factura emitida al cliente (`facturas`)
 */
import { supabase } from "@/integrations/supabase/client";

export type EstatusSat = "Vigente" | "Cancelado" | "No Encontrado" | "Error";
export type TipoCfdi = "cxp" | "cxc";

export interface VerificarUuidResult {
  estatus: EstatusSat;
  raw?: string;
}

export async function verificarUuidSat(
  facturaId: string,
  tipo: TipoCfdi = "cxp",
): Promise<VerificarUuidResult> {
  const { data, error } = await supabase.functions.invoke<VerificarUuidResult & { error?: string; detail?: string }>(
    "verificar-uuid-sat",
    { body: { factura_id: facturaId, tipo } },
  );
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.detail ?? data.error);
  return data as VerificarUuidResult;
}
