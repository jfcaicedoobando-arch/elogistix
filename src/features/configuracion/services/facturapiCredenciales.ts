/**
 * Servicio para la tabla `public.facturapi_credenciales`.
 *
 * NUNCA almacena la API key real; sólo guarda el NOMBRE del secret donde
 * vive (ej. `FACTURAPI_KEY_ACME_SANDBOX`). La key real se carga como secret
 * de Supabase y la edge function `_shared/facturapiAuth.ts` la resuelve.
 */
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import { run, unwrap } from "@/lib/supabase/response";
import { registrarActividad } from "@/services/bitacora/registrar";

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
  api_key_sandbox_secret_name?: string | null;
  api_key_live_secret_name?: string | null;
  datos_fiscales_completos: boolean;
  certificado_cargado: boolean;
  certificado_vence_at: string | null;
}

export async function fetchFacturapiCredenciales(
  orgId: string,
): Promise<FacturapiCredencialesRow | null> {
  const data = await unwrap(
    supabase
      .from("facturapi_credenciales")
      .select("*")
      .eq("organization_id", orgId)
      .maybeSingle(),
  );
  return data ? fromDb<FacturapiCredencialesRow>(data) : null;
}

export async function upsertFacturapiCredenciales(
  orgId: string,
  input: FacturapiCredencialesInput,
): Promise<void> {
  await run(
    supabase
      .from("facturapi_credenciales")
      .upsert(
        { organization_id: orgId, ...input },
        { onConflict: "organization_id" },
      ),
  );
  // SEGURIDAD: jamás registrar la api key/token; sólo el ambiente configurado.
  await registrarActividad({
    modulo: "configuracion",
    accion: "configurar_credenciales_facturapi",
    entidadId: orgId,
    detalles: { ambiente: input.ambiente },
  });
}


/**
 * Guarda la API key real (sandbox o live) en el Vault del servidor mediante el
 * RPC `set_facturapi_api_key`. La key nunca regresa al cliente; sólo se guarda
 * `last4` para mostrar como referencia visual.
 */
export async function setFacturapiApiKey(
  orgId: string,
  ambiente: FacturapiAmbiente,
  apiKey: string,
): Promise<void> {
  // SAFE-CAST: RPC tipada en supabase/types.ts no se ha regenerado todavía.
  await run(
    supabase.rpc("set_facturapi_api_key" as never, {
      p_org_id: orgId,
      p_ambiente: ambiente,
      p_api_key: apiKey,
    } as never),
  );
  // SEGURIDAD: jamás registrar la api key/token; sólo el ambiente afectado.
  await registrarActividad({
    modulo: "configuracion",
    accion: "configurar_credenciales_facturapi",
    entidadId: orgId,
    detalles: { ambiente },
  });
}

export async function clearFacturapiApiKey(
  orgId: string,
  ambiente: FacturapiAmbiente,
): Promise<void> {
  // SAFE-CAST: RPC nueva, types.ts pendiente de regenerar.
  await run(
    supabase.rpc("clear_facturapi_api_key" as never, {
      p_org_id: orgId,
      p_ambiente: ambiente,
    } as never),
  );
  // SEGURIDAD: jamás registrar la api key/token; sólo el ambiente afectado.
  await registrarActividad({
    modulo: "configuracion",
    accion: "borrar_api_key_facturapi",
    entidadId: orgId,
    detalles: { ambiente },
  });
}

export interface ProbarConexionResult {
  ok: boolean;
  ambiente?: FacturapiAmbiente;
  facturapi_org_id?: string | null;
  nombre?: string | null;
  status?: number;
  detail?: unknown;
  error?: string;
  message?: string;
}

export async function probarFacturapiConexion(
  orgId: string,
  ambiente: FacturapiAmbiente,
): Promise<ProbarConexionResult> {
  const { data, error } = await supabase.functions.invoke<ProbarConexionResult>(
    "facturapi-test-conexion",
    { body: { organization_id: orgId, ambiente } },
  );
  if (error) {
    const raw = error.message ?? "";
    const friendly = /failed to send a request/i.test(raw)
      ? "No fue posible contactar al servidor de FacturApi (timeout o red). Intenta nuevamente en unos segundos."
      : raw || "Error desconocido al probar la conexión con FacturApi.";
    throw new Error(friendly);
  }
  return data ?? { ok: false, error: "empty_response" };
}
