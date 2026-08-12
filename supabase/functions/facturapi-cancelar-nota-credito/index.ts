/**
 * facturapi-cancelar-nota-credito — Cancela un CFDI tipo E (NC) en FacturApi.
 * Motivos SAT 01/02/03/04 igual que en facturas.
 *
 * Entrada: { nota_credito_id, motivo: '01'|'02'|'03'|'04', sustituye_uuid? }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";
import { resolveFacturapiKey } from "../_shared/facturapiAuth.ts";
import { getFacturapiClient, describeFacturapiError, extractFacturapiMessage, withFacturapiTimeout, FacturapiTimeoutError } from "../_shared/facturapiClient.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse, makeJson } from "../_shared/response.ts";
import { preloadCancelContext, validateRequest, type ReqBody } from "./contexto.ts";
import { handleCancelOutcome, type FapiCancelResponse } from "./terminales.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
void Deno.env.get("FACTURAPI_KEY");
void resolveFacturapiKey;

export { validateRequest };

Deno.serve(wrapEdgeHandler("facturapi-cancelar-nota-credito", async (req) => {
  // EF-10: endpoints con JWT usan CORS de whitelist (guía _shared/cors.ts).
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const json = makeJson(req);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userData.user) return json({ error: "unauthorized" }, 401);

  const body = (await req.json().catch(() => ({}))) as ReqBody;
  const invalid = validateRequest(req, body);
  if (invalid) return invalid;

  const ctxResult = await preloadCancelContext(supabase, body, userData.user.id);
  if (!ctxResult.ok) return ctxResult.response;
  const { nc, sustituyeFacturapiId } = ctxResult;

  const resolved = await getFacturapiClient(supabase, nc.organization_id);
  if (!resolved.ok) return json({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);
  const facturapi = resolved.data.client;

  let cancelResp: FapiCancelResponse;
  try {
    // Ola 4 · N4: `substitution` lleva el ObjectId de la sustituta, no el UUID.
    const cancelPayload: { motive: string; substitution?: string } = { motive: body.motivo! };
    if (sustituyeFacturapiId) cancelPayload.substitution = sustituyeFacturapiId;
    // EF-05: timeout defensivo — el cron reconciliar-cancelaciones (EF-03)
    // sincroniza el estado real de la NC.
    cancelResp = await withFacturapiTimeout("invoices.cancel", facturapi.invoices.cancel(nc.facturapi_id, cancelPayload)) as FapiCancelResponse;
  } catch (err) {
    if (err instanceof FacturapiTimeoutError) {
      await registrarBitacoraEdge(supabase, {
        organizationId: nc.organization_id,
        usuarioId: userData.user.id,
        usuarioEmail: userData.user.email,
        modulo: "facturacion",
        accion: "facturapi_nc_cancelar_timeout",
        entidadId: body.nota_credito_id,
        detalles: { op: err.op, timeout_ms: err.timeoutMs },
      });
      return json({ error: "facturapi_timeout", op: err.op, timeout_ms: err.timeoutMs, message: err.message }, 504);
    }
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
    return json({ error: "facturapi_error", status, detail, message }, 502);
  }

  return handleCancelOutcome(supabase, {
    ncId: body.nota_credito_id!,
    organizationId: nc.organization_id,
    usuarioId: userData.user.id,
    usuarioEmail: userData.user.email,
    motivo: body.motivo,
    sustituyeUuid: body.sustituye_uuid ?? null,
  }, cancelResp);
}));
