/**
 * facturapi-cancelar-nota-credito — Cancela un CFDI tipo E (NC) en FacturApi.
 * Motivos SAT 01/02/03/04 igual que en facturas.
 *
 * Entrada: { nota_credito_id, motivo: '01'|'02'|'03'|'04', sustituye_uuid? }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";
import { resolveFacturapiKey } from "../_shared/facturapiAuth.ts";
import { authorizeOrgRole, ROLES_EMISOR_FISCAL } from "../_shared/auth.ts";
import { getFacturapiClient, describeFacturapiError, extractFacturapiMessage } from "../_shared/facturapiClient.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse } from "../_shared/response.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
void Deno.env.get("FACTURAPI_KEY");
void resolveFacturapiKey;

const MOTIVOS_VALIDOS = new Set(["01", "02", "03", "04"]);

interface ReqBody {
  nota_credito_id?: string;
  motivo?: string;
  sustituye_uuid?: string;
}

function validateRequest(req: Request, body: ReqBody): Response | null {
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!body.nota_credito_id) return jsonResponse({ error: "nota_credito_id_required" }, 400);
  if (!body.motivo || !MOTIVOS_VALIDOS.has(body.motivo)) {
    return jsonResponse({ error: "motivo_invalido", message: "Motivo SAT requerido (01-04)." }, 400);
  }
  if (body.motivo === "01" && !body.sustituye_uuid) {
    return jsonResponse({ error: "sustituye_uuid_required", message: "El motivo 01 requiere UUID de sustitución." }, 400);
  }
  return null;
}

Deno.serve(wrapEdgeHandler("facturapi-cancelar-nota-credito", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userData.user) return jsonResponse({ error: "unauthorized" }, 401);

  const body = (await req.json().catch(() => ({}))) as ReqBody;
  const invalid = validateRequest(req, body);
  if (invalid) return invalid;


  const { data: nc, error: ncErr } = await supabase
    .from("factura_notas_credito")
    .select("id, organization_id, facturapi_id, estado")
    .eq("id", body.nota_credito_id)
    .maybeSingle();
  if (ncErr || !nc) return jsonResponse({ error: "nota_credito_not_found" }, 404);
  if (!nc.facturapi_id) return jsonResponse({ error: "no_timbrada" }, 409);
  if (!(await authorizeOrgRole(supabase, userData.user.id, nc.organization_id, ROLES_EMISOR_FISCAL))) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const resolved = await getFacturapiClient(supabase, nc.organization_id);
  if (!resolved.ok) return jsonResponse({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);
  const facturapi = resolved.data.client;

  interface FapiCancelResponse { status?: string }
  let cancelResp: FapiCancelResponse;
  try {
    cancelResp = await facturapi.invoices.cancel(
      nc.facturapi_id,
      { motive: body.motivo, substitution: body.sustituye_uuid },
    ) as FapiCancelResponse;
  } catch (err) {
    const { status, detail } = describeFacturapiError(err);
    await registrarBitacoraEdge(supabase, {
      organizationId: nc.organization_id,
      usuarioId: userData.user.id,
      usuarioEmail: userData.user.email,
      modulo: "facturacion",
      accion: "facturapi_nc_cancelar_failed",
      entidadId: body.nota_credito_id,
      detalles: { status, response: detail },
    });
    const message = extractFacturapiMessage(detail, status);
    return jsonResponse({ error: "facturapi_error", status, detail, message }, 502);
  }

  const { error: updErr } = await supabase
    .from("factura_notas_credito")
    .update({
      estado: "Cancelada",
      cancelacion_motivo: body.motivo,
      cancelado_en: new Date().toISOString(),
    })
    .eq("id", body.nota_credito_id);
  if (updErr) return jsonResponse({ error: "db_update_failed", detail: updErr.message }, 500);

  await registrarBitacoraEdge(supabase, {
    organizationId: nc.organization_id,
    usuarioId: userData.user.id,
    usuarioEmail: userData.user.email,
    modulo: "facturacion",
    accion: "facturapi_nc_cancelada",
    entidadId: body.nota_credito_id,
    detalles: { motivo: body.motivo, sustituye_uuid: body.sustituye_uuid ?? null },
  });

  return jsonResponse({ ok: true, status: cancelResp.status ?? "canceled" });
}));
