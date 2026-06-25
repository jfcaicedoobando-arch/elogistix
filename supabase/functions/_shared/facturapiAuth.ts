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
// deno-lint-ignore-file no-explicit-any

export const FACTURAPI_BASE = "https://www.facturapi.io/v2";

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

/**
 * Carga credenciales de FacturApi para una organización y resuelve la API key
 * desde el secret apropiado según el ambiente (sandbox/live).
 */
export async function resolveFacturapiKey(
  supabase: any,
  organizationId: string,
): Promise<FacturapiResolveResult> {
  const { data: cred } = await supabase
    .from("facturapi_credenciales")
    .select(
      "ambiente, api_key_sandbox_secret_name, api_key_live_secret_name, facturapi_org_id",
    )
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!cred) {
    // Compatibilidad: usar la key global mientras se migra la org.
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

  const ambiente: FacturapiAmbiente = cred.ambiente === "live" ? "live" : "sandbox";
  const secretName: string | null = ambiente === "live"
    ? cred.api_key_live_secret_name
    : cred.api_key_sandbox_secret_name;

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
