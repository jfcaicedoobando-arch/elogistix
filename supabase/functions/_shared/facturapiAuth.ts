/**
 * facturapiAuth — Resuelve la API key de FacturApi para una organización
 * (multi-tenant) consultando `public.facturapi_credenciales`.
 *
 * La tabla guarda el NOMBRE del secret donde vive la API key; la key real
 * vive como secret de Supabase (`FACTURAPI_KEY_<ORG>_SANDBOX|LIVE`).
 *
 * Compatibilidad hacia atrás: si la org no tiene fila en `facturapi_credenciales`
 * pero existe el secret global `FACTURAPI_KEY`, se usa ese (modo legacy).
 *
 * Uso típico en una edge function:
 *
 *   const resolved = await resolveFacturapiKey(supabase, factura.organization_id);
 *   if (!resolved.ok) return json(resolved.data, resolved.data.status);
 *   const { apiKey, baseUrl } = resolved.data;
 */


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
        maybeSingle: () => Promise<{ data: FacturapiCredencialRow | null; error: unknown }>;
      };
    };
  };
  rpc?: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: string | null; error: unknown }>;
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

function legacyFallback(): FacturapiResolveResult {
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
  return {
    ok: false,
    data: {
      error: "org_facturapi_not_configured",
      message:
        "Esta organización no tiene FacturApi configurado. Ve a Configuración → Facturación electrónica.",
      status: 412,
    },
  };
}

async function tryVaultKey(
  supabase: SupabaseLike,
  organizationId: string,
  ambiente: FacturapiAmbiente,
  vaultId: string | null,
): Promise<string | null> {
  if (!vaultId || !supabase.rpc) return null;
  const { data, error } = await supabase.rpc("get_facturapi_api_key_internal", {
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

  if (!cred) return legacyFallback();

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
    return {
      ok: false,
      data: {
        error: "org_facturapi_not_configured",
        message: `Falta la API key (${ambiente}) de FacturApi para esta organización.`,
        status: 412,
      },
    };
  }

  const apiKey = Deno.env.get(secretName) ?? "";
  if (!apiKey) {
    return {
      ok: false,
      data: {
        error: "missing_facturapi_key",
        message: `El secret ${secretName} no está configurado en el proyecto.`,
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


