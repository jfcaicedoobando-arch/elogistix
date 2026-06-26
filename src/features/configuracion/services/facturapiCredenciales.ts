/**
 * Servicio para la tabla `public.facturapi_credenciales`.
 *
 * NUNCA almacena la API key real; sólo guarda el NOMBRE del secret donde
 * vive (ej. `FACTURAPI_KEY_ACME_SANDBOX`). La key real se carga como secret
 * de Supabase y la edge function `_shared/facturapiAuth.ts` la resuelve.
 */
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";

export type FacturapiAmbiente = "sandbox" | "live";

export interface FacturapiCredencialesRow {
  organization_id: string;
  facturapi_org_id: string | null;
  ambiente: FacturapiAmbiente;
  api_key_sandbox_secret_name: string | null;
  api_key_live_secret_name: string | null;
  api_key_sandbox_vault_id: string | null;
  api_key_live_vault_id: string | null;
  api_key_sandbox_last4: string | null;
  api_key_live_last4: string | null;
  certificado_cargado: boolean;
  certificado_vence_at: string | null;
  webhook_secret: string | null;
  last_test_timbre_at: string | null;
  datos_fiscales_completos: boolean;
  created_at: string;
  updated_at: string;
}

export interface FacturapiCredencialesInput {
  facturapi_org_id: string | null;
  ambiente: FacturapiAmbiente;
  api_key_sandbox_secret_name: string | null;
  api_key_live_secret_name: string | null;
  datos_fiscales_completos: boolean;
  certificado_cargado: boolean;
  certificado_vence_at: string | null;
}

export async function fetchFacturapiCredenciales(
  orgId: string,
): Promise<FacturapiCredencialesRow | null> {
  const { data, error } = await supabase
    .from("facturapi_credenciales")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw error;
  return data ? fromDb<FacturapiCredencialesRow>(data) : null;
}

export async function upsertFacturapiCredenciales(
  orgId: string,
  input: FacturapiCredencialesInput,
): Promise<void> {
  const { error } = await supabase
    .from("facturapi_credenciales")
    .upsert(
      { organization_id: orgId, ...input },
      { onConflict: "organization_id" },
    );
  if (error) throw error;
}

/** Convención estable para nombrar el secret según ambiente. */
export function defaultSecretName(orgId: string, ambiente: FacturapiAmbiente): string {
  const short = orgId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `FACTURAPI_KEY_${short}_${ambiente.toUpperCase()}`;
}
