/**
 * Reconciliación de facturas con reserva `PENDING:<uuid>` en FacturApi.
 * Extraído de `ClaimPendingBanner.tsx` para mantener el component sin
 * dependencias directas al cliente Supabase.
 */
import { supabase } from "@/integrations/supabase/client";

export type RecuperarClaimOutcome =
  | "promovido"
  | "liberado"
  | "sin_cambios"
  | "too_early"
  | "no_pending"
  | "claim_perdido";

export interface RecuperarClaimResponse {
  outcome: RecuperarClaimOutcome;
  message?: string;
  edad_minutos?: number;
}

export async function recuperarClaimFactura(
  facturaId: string,
): Promise<RecuperarClaimResponse> {
  const { data, error } = await supabase.functions.invoke<RecuperarClaimResponse>(
    "facturapi-recuperar-claim",
    { body: { factura_id: facturaId } },
  );
  if (error) throw error;
  return data ?? { outcome: "sin_cambios" };
}
