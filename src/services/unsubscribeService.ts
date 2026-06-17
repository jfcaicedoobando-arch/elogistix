/**
 * Wrapper del edge function `handle-email-unsubscribe`.
 *
 * Encapsula la llamada a Supabase Functions para que el componente UI
 * (`pages/auth/Unsubscribe.tsx`) no acceda a `fetch()` raw ni a las
 * variables `VITE_SUPABASE_*` directamente.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ValidateTokenResult {
  valid: boolean;
  reason?: "already_unsubscribed" | string;
}

export interface ConfirmUnsubscribeResult {
  success: boolean;
  reason?: "already_unsubscribed" | string;
  error?: string;
}

export async function validateUnsubscribeToken(token: string): Promise<ValidateTokenResult> {
  const { data, error } = await supabase.functions.invoke<ValidateTokenResult>(
    `handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
    { method: "GET" },
  );
  if (error) throw error;
  return data ?? { valid: false };
}

export async function confirmUnsubscribe(token: string): Promise<ConfirmUnsubscribeResult> {
  const { data, error } = await supabase.functions.invoke<ConfirmUnsubscribeResult>(
    "handle-email-unsubscribe",
    { method: "POST", body: { token } },
  );
  if (error) throw error;
  return data ?? { success: false, error: "No se pudo procesar la baja" };
}
