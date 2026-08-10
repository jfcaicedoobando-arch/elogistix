/**
 * Service wrapper para el RPC `complete_onboarding`. Mantenemos pages/
 * fuera de imports directos a supabase/client (Power of 10 / arch baseline).
 */
import { supabase } from "@/integrations/supabase/client";

export interface CompleteOnboardingInput {
  /** Ola 4 · N30: la RPC ya no elige la org sola (LIMIT 1 arbitrario). */
  organizationId: string;
  rfc: string;
  direccion: string;
  moneda: string;
}

export async function completeOnboarding({ organizationId, rfc, direccion, moneda }: CompleteOnboardingInput) {
  const { error } = await supabase.rpc("complete_onboarding", {
    _organization_id: organizationId,
    _rfc: rfc,
    _direccion: direccion,
    _moneda: moneda,
  });
  if (error) throw error;
}
