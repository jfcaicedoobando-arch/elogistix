/**
 * facturapiAuth — Resuelve la API key de FacturApi para una organización
 * (multi-tenant) consultando `public.facturapi_credenciales`.
 *
 * La tabla guarda el NOMBRE del secret donde vive la API key; la key real
 * vive como secret de Supabase (`FACTURAPI_KEY_<ORG>_SANDBOX|LIVE`).
 *
 * P1-4: fail-closed por organización. Si la org no tiene fila en
 * `facturapi_credenciales`, YA NO se cae al secret global `FACTURAPI_KEY`
 * para cualquier organización (riesgo de mezclar cuenta/folios entre
 * tenants). El único fallback permitido es para la organización legacy
 * exacta declarada en el secret `LEGACY_FACTURAPI_ORG_ID` (una sola org,
 * documentada aquí: es la organización que usaba FacturApi antes de que
 * existiera `facturapi_credenciales` multi-tenant). Ninguna otra
 * organización puede usar ese fallback.
 *
 * El mensaje de error devuelto al cliente es genérico en español y NUNCA
 * incluye nombres de secrets ni detalles internos; esos detalles sólo se
 * registran en logs del servidor (`console.error`).
 *
 * Uso típico en una edge function:
 *
 *   const resolved = await resolveFacturapiKey(supabase, factura.organization_id);
 *   if (!resolved.ok) return json(resolved.data, resolved.data.status);
 *   const { apiKey, baseUrl } = resolved.data;
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";



export const FACTURAPI_BASE = "https://www.facturapi.io/v2";

/** Header `Authorization: Basic ...` para Facturapi (usuario = api key, password vacío). */
export function basicAuthHeader(apiKey: string): string {
  const g = globalThis as { Buffer?: { from: (s: string) => { toString: (enc: string) => string } } };
  const b64 = typeof btoa === "function"
    ? btoa(`${apiKey}:`)
    : g.Buffer!.from(`${apiKey}:`).toString("base64");
  return `Basic ${b64}`;
}

/** Forma mínima estructural del cliente de Supabase que necesitamos aquí. */
interface FacturapiCredencialRow {
  ambiente: string | null;
  api_key_sandbox_secret_name: string | null;
  api_key_live_secret_name: string | null;
  api_key_sandbox_vault_id: string | null;
  api_key_live_vault_id: string | null;
  facturapi_org_id: string | null;
}
export interface SupabaseLike {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        // RTC-01: thenable de PostgREST (no `Promise` nominal).
        maybeSingle: () => PromiseLike<{ data: FacturapiCredencialRow | null; error: unknown }>;
      };
    };
  };
  rpc?: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: string | null; error: unknown }>;
}

export type FacturapiAmbiente = "sandbox" | "live";

export interface FacturapiResolved {
  apiKey: string;
  ambiente: FacturapiAmbiente;
  baseUrl: string;
  facturapiOrgId: string | null;
  /** true cuando se cayó al secret global `FACTURAPI_KEY` (sin fila en la tabla). */
  legacy: boolean;
}

export interface FacturapiResolveError {
  error: "org_facturapi_not_configured" | "missing_facturapi_key";
  message: string;
  status: number;
}

export type FacturapiResolveResult =
  | { ok: true; data: FacturapiResolved }
  | { ok: false; data: FacturapiResolveError };

const GENERIC_NOT_CONFIGURED_MSG =
  "Esta organización no tiene FacturApi configurado. Ve a Configuración → Facturación electrónica.";

/**
 * Única excepción fail-closed: si `organizationId` coincide EXACTAMENTE con
 * el secret `LEGACY_FACTURAPI_ORG_ID`, se permite usar el secret global
 * `FACTURAPI_KEY`. Cualquier otra organización sin fila en
 * `facturapi_credenciales` recibe un error genérico (fail-closed).
 */
function legacyFallback(organizationId: string): FacturapiResolveResult {
  const legacyOrgId = Deno.env.get("LEGACY_FACTURAPI_ORG_ID") ?? "";
  if (legacyOrgId && organizationId === legacyOrgId) {
    const legacy = Deno.env.get("FACTURAPI_KEY") ?? "";
    if (legacy) {
      return {
        ok: true,
        data: {
          apiKey: legacy,
          ambiente: "sandbox",
          baseUrl: FACTURAPI_BASE,
          facturapiOrgId: null,
          legacy: true,
        },
      };
    }
    console.error("[facturapiAuth] LEGACY_FACTURAPI_ORG_ID configurado pero FACTURAPI_KEY ausente", {
      organizationId,
    });
  }
  return {
    ok: false,
    data: {
      error: "org_facturapi_not_configured",
      message: GENERIC_NOT_CONFIGURED_MSG,
      status: 412,
    },
  };
}

let adminSingleton: SupabaseLike | null = null;
/**
 * Cliente admin (service_role) para llamar RPCs privilegiadas como
 * `get_facturapi_api_key_internal`, que están REVOKE FROM authenticated.
 * En producción SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY siempre existen.
 * En tests (Deno.test aislado) no están seteados → devolvemos null y
 * `tryVaultKey` usa el cliente mock inyectado por el caller.
 */
function getAdminClient(): SupabaseLike | null {
  if (adminSingleton) return adminSingleton;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  adminSingleton = createClient(url, key, {
    auth: { persistSession: false },
  }) as unknown as SupabaseLike;
  return adminSingleton;
}

async function tryVaultKey(
  supabase: SupabaseLike,
  organizationId: string,
  ambiente: FacturapiAmbiente,
  vaultId: string | null,
): Promise<string | null> {
  if (!vaultId) return null;
  // La RPC está GRANTed sólo a service_role; el cliente user-scoped
  // (Authorization: Bearer <user_jwt>) recibe permission denied. Usamos
  // un cliente admin dedicado; fallback al mock del caller en tests.
  const client = getAdminClient() ?? supabase;
  if (!client.rpc) return null;
  const { data, error } = await client.rpc("get_facturapi_api_key_internal", {

    p_org_id: organizationId,
    p_ambiente: ambiente,
  });
  if (error) return null;
  return typeof data === "string" && data.length > 0 ? data : null;
}

function resolveSecretName(cred: FacturapiCredencialRow, ambiente: FacturapiAmbiente): string | null {
  return ambiente === "live" ? cred.api_key_live_secret_name : cred.api_key_sandbox_secret_name;
}

/**
 * Carga credenciales de FacturApi para una organización y resuelve la API key
 * desde el secret apropiado según el ambiente (sandbox/live).
 */
export async function resolveFacturapiKey(
  supabase: SupabaseLike,
  organizationId: string,
): Promise<FacturapiResolveResult> {
  const { data: cred } = await supabase
    .from("facturapi_credenciales")
    .select(
      "ambiente, api_key_sandbox_secret_name, api_key_live_secret_name, api_key_sandbox_vault_id, api_key_live_vault_id, facturapi_org_id",
    )
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!cred) return legacyFallback(organizationId);

  const ambiente: FacturapiAmbiente = cred.ambiente === "live" ? "live" : "sandbox";
  const vaultId = ambiente === "live" ? cred.api_key_live_vault_id : cred.api_key_sandbox_vault_id;

  const vaultKey = await tryVaultKey(supabase, organizationId, ambiente, vaultId);
  if (vaultKey) {
    return {
      ok: true,
      data: {
        apiKey: vaultKey,
        ambiente,
        baseUrl: FACTURAPI_BASE,
        facturapiOrgId: cred.facturapi_org_id ?? null,
        legacy: false,
      },
    };
  }

  const secretName = resolveSecretName(cred, ambiente);
  if (!secretName) {
    console.error("[facturapiAuth] org sin secret_name asignado para su ambiente", {
      organizationId, ambiente,
    });
    return {
      ok: false,
      data: {
        error: "org_facturapi_not_configured",
        message: GENERIC_NOT_CONFIGURED_MSG,
        status: 412,
      },
    };
  }

  const apiKey = Deno.env.get(secretName) ?? "";
  if (!apiKey) {
    // No revelar el nombre del secret al cliente; sólo en logs de servidor.
    console.error("[facturapiAuth] secret configurado en BD pero ausente en el entorno", {
      organizationId, ambiente, secretName,
    });
    return {
      ok: false,
      data: {
        error: "missing_facturapi_key",
        message: "FacturApi no está disponible en este momento para esta organización.",
        status: 500,
      },
    };
  }

  return {
    ok: true,
    data: {
      apiKey,
      ambiente,
      baseUrl: FACTURAPI_BASE,
      facturapiOrgId: cred.facturapi_org_id ?? null,
      legacy: false,
    },
  };
}

/**
 * Devuelve la API key del ambiente OPUESTO al configurado en la org, si
 * existe. Sirve como fallback para facturas históricas timbradas en un
 * ambiente distinto al actual (típico cuando la org migra de sandbox → live
 * y las facturas viejas siguen guardando su `facturapi_id` original).
 * Devuelve `null` si no hay credencial, no hay secret configurado o si el
 * secret está vacío.
 */
export async function resolveFacturapiKeyOtherAmbiente(
  supabase: SupabaseLike,
  organizationId: string,
): Promise<{ apiKey: string; ambiente: FacturapiAmbiente } | null> {
  const { data: cred } = await supabase
    .from("facturapi_credenciales")
    .select(
      "ambiente, api_key_sandbox_secret_name, api_key_live_secret_name, api_key_sandbox_vault_id, api_key_live_vault_id, facturapi_org_id",
    )
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!cred) return null;
  const current: FacturapiAmbiente = cred.ambiente === "live" ? "live" : "sandbox";
  const other: FacturapiAmbiente = current === "live" ? "sandbox" : "live";
  const vaultId = other === "live" ? cred.api_key_live_vault_id : cred.api_key_sandbox_vault_id;
  const vaultKey = await tryVaultKey(supabase, organizationId, other, vaultId);
  if (vaultKey) return { apiKey: vaultKey, ambiente: other };
  const secretName = other === "live" ? cred.api_key_live_secret_name : cred.api_key_sandbox_secret_name;
  if (!secretName) return null;
  const apiKey = Deno.env.get(secretName) ?? "";
  if (!apiKey) return null;
  return { apiKey, ambiente: other };
}



