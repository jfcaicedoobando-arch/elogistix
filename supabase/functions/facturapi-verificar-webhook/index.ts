/**
 * facturapi-verificar-webhook — Verificación REMOTA, opt-in y administrativa,
 * de la configuración del webhook de FacturAPI para UN ambiente concreto
 * (sandbox o live).
 *
 * P2-A · FacturAPI 5.0. Se llama a mano desde Configuración → Facturación
 * electrónica; nunca en el camino del timbrado. Compara contra el proveedor:
 * la URL registrada, los eventos suscritos y el estado del webhook, y persiste
 * el diagnóstico en las columnas del ambiente verificado.
 *
 * SEGURIDAD: la respuesta NUNCA incluye la API key ni el secret del webhook;
 * sólo URL, id, eventos y estado. Requiere rol emisor fiscal en la org.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";
import { jsonResponse } from "../_shared/response.ts";
import { authorizeOrgRole, ROLES_EMISOR_FISCAL } from "../_shared/auth.ts";
import {
  basicAuthHeader,
  resolveFacturapiKey,
  resolveFacturapiKeyOtherAmbiente,
  FACTURAPI_BASE,
} from "../_shared/facturapiAuth.ts";
import {
  compararConfigRemota,
  COLS_WEBHOOK_CRED,
  elegirWebhookRemoto,
  patchVerificacion,
  secretPorAmbiente,
  tieneSecretPorAmbiente,
  urlWebhookEsperada,
  type CredencialWebhookRow,
  type FacturapiAmbiente,
} from "../_shared/facturapiWebhookConfig.ts";

import {
  metadatosErrorFacturapi,
  normalizarErrorFacturapi,
} from "../_shared/facturapiErrorNormalizado.ts";
import type { FacturapiWebhookRemoto } from "../_shared/facturapiSdk.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface Body {
  organization_id?: string;
  ambiente?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

async function autorizar(req: Request, orgId: string, admin: SB): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "unauthorized" }, 401);
  const sbUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await sbUser.auth.getUser(authHeader.replace("Bearer ", ""));
  const userId = data?.user?.id;
  if (error || !userId) return jsonResponse({ error: "unauthorized" }, 401);
  const permitido = await authorizeOrgRole(admin, userId, orgId, ROLES_EMISOR_FISCAL);
  if (!permitido) return jsonResponse({ error: "forbidden" }, 403);
  return null;
}

/**
 * `GET /webhooks` por REST (misma vía que `facturapi-test-conexion`): evita
 * arrastrar el import estático del SDK a esta función administrativa.
 */
async function listarWebhooksRemotos(apiKey: string): Promise<FacturapiWebhookRemoto[]> {
  const res = await fetch(`${FACTURAPI_BASE}/webhooks?limit=50`, {
    headers: { Authorization: basicAuthHeader(apiKey), Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detalle = await res.text();
    throw Object.assign(new Error("facturapi_http_error"), {
      status: res.status,
      headers: res.headers,
      data: { message: detalle || res.statusText },
    });
  }
  const cuerpo = await res.json() as { data?: FacturapiWebhookRemoto[] } | FacturapiWebhookRemoto[];
  if (Array.isArray(cuerpo)) return cuerpo;
  return cuerpo.data ?? [];
}

Deno.serve(wrapEdgeHandler("facturapi-verificar-webhook", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => ({})) as Body;
  const orgId = body.organization_id;
  if (!orgId) return jsonResponse({ error: "missing_organization_id" }, 400);
  if (body.ambiente !== "sandbox" && body.ambiente !== "live") {
    return jsonResponse({ error: "ambiente_invalido" }, 400);
  }
  const ambiente = body.ambiente as FacturapiAmbiente;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const noAutorizado = await autorizar(req, orgId, admin);
  if (noAutorizado) return noAutorizado;

  const { data: cred } = await admin
    .from("facturapi_credenciales")
    .select(COLS_WEBHOOK_CRED)
    .eq("organization_id", orgId)
    .maybeSingle();
  const row = cred as CredencialWebhookRow | null;
  // Aislamiento: el diagnóstico de un ambiente usa el secret de ESE ambiente.
  const secretDelAmbiente = secretPorAmbiente(row, ambiente);
  const urlsAceptadas = [
    urlWebhookEsperada(SUPABASE_URL, orgId),
    urlWebhookEsperada(SUPABASE_URL, orgId, ambiente),
  ];

  // La API key también es la del ambiente PEDIDO: si no es el activo se resuelve
  // la del otro ambiente explícitamente (nunca se inventa ni se reutiliza).
  const resolved = await resolveFacturapiKey(admin, orgId);
  if (!resolved.ok) return jsonResponse(resolved.data, resolved.data.status);
  let apiKey = resolved.data.apiKey;
  if (resolved.data.ambiente !== ambiente) {
    const otra = await resolveFacturapiKeyOtherAmbiente(admin, orgId);
    if (!otra || otra.ambiente !== ambiente) {
      return jsonResponse({
        error: "ambiente_sin_credencial",
        message: `Esta organización no tiene clave de API configurada para el ambiente ` +
          `${ambiente === "live" ? "Producción" : "Pruebas"}. Configúrala para poder verificarlo.`,
      }, 409);
    }
    apiKey = otra.apiKey;
  }

  let remotos: FacturapiWebhookRemoto[];
  try {
    remotos = await listarWebhooksRemotos(apiKey);
  } catch (err) {
    const norm = normalizarErrorFacturapi(err);
    console.error("[facturapi-verificar-webhook] listado remoto falló", metadatosErrorFacturapi(norm));
    await admin.from("facturapi_credenciales")
      .update({ [`webhook_estado_${ambiente}`]: "error", [`webhook_verificado_${ambiente}_at`]: new Date().toISOString() })
      .eq("organization_id", orgId);
    return jsonResponse({
      error: "verificacion_no_disponible",
      message: norm.mensajeUsuario,
      retryable: norm.reintentable,
      retry_after_segundos: norm.retryAfterSegundos ?? null,
    }, norm.status === 429 ? 429 : 502);
  }

  const remoto = elegirWebhookRemoto(
    remotos,
    urlsAceptadas,
    ambiente === "live" ? row?.webhook_id_live : row?.webhook_id_sandbox,
  ) as FacturapiWebhookRemoto | null;

  const diagnostico = compararConfigRemota({
    ambiente,
    urlEsperada: urlsAceptadas,
    secretConfigurado: Boolean(secretDelAmbiente),
    // El legado ya no valida firmas cuando hay secret por ambiente.
    secretLegado: !secretDelAmbiente && !tieneSecretPorAmbiente(row) && Boolean(row?.webhook_secret),
    remoto,
  });


  await admin.from("facturapi_credenciales")
    .update(patchVerificacion(diagnostico))
    .eq("organization_id", orgId);

  return jsonResponse({ ok: diagnostico.estado === "ok", diagnostico });
}));
