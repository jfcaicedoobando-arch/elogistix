/**
 * Service wrapper para el RPC `complete_onboarding`. Mantenemos pages/
 * fuera de imports directos a supabase/client (Power of 10 / arch baseline).
 */
import { supabase } from "@/integrations/supabase/client";

export interface CompleteOnboardingInput {
  rfc: string;
  direccion: string;
  moneda: string;
}

export async function completeOnboarding({ rfc, direccion, moneda }: CompleteOnboardingInput) {
  const { error } = await supabase.rpc("complete_onboarding", {
    _rfc: rfc,
    _direccion: direccion,
    _moneda: moneda,
  });
  if (error) throw error;
}
