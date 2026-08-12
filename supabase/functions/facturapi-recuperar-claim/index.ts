/**
 * facturapi-recuperar-claim — Recupera claims PENDING:<uuid> huérfanos.
 *
 * Si Facturapi ya timbró un CFDI con el `external_id` del claim, promovemos la
 * fila local con los datos reales. Si no, y el claim ya tiene edad mínima,
 * lo liberamos vía RPC para permitir un reintento seguro.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";
import { getFacturapiClient } from "../_shared/facturapiClient.ts";
import { authorizeOrgRole, ROLES_EMISOR_FISCAL } from "../_shared/auth.ts";
import { jsonResponse } from "../_shared/response.ts";
import {
  loadFactura, loadNotaCredito, loadPago, validarClaim, buscarCfdiPorExternalId,
  promoverFactura, promoverNc, promoverPago, liberarClaim, liberarClaimNc, liberarClaimPago,
  type ReqBody, type FapiClient,
} from "./recuperar.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
type Usuario = { id: string; email?: string };

/**
 * Ola 5 · RG4-4: la emisión de NC (Ola 4 · N1) también usa claim
 * PENDING:<uuid> + external_id; si la edge muere entre el timbrado y el
 * persist, preloadNcContext devuelve 409 ya_timbrada para siempre. Aquí la
 * reconciliamos contra FacturAPI con el mismo flujo que las facturas.
 */
async function recuperarNotaCredito(supabase: SB, user: Usuario, ncId: string): Promise<Response> {
  const nc = await loadNotaCredito(supabase, ncId);
  if (nc instanceof Response) return nc;

  if (!(await authorizeOrgRole(supabase, user.id, nc.organization_id, ROLES_EMISOR_FISCAL))) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const { claimTag, edadMin, response: ncValidation } = validarClaim(nc, "nota de crédito");
  if (ncValidation) return ncValidation;

  const resolved = await getFacturapiClient(supabase, nc.organization_id);
  if (!resolved.ok) {
    return jsonResponse(
      { error: resolved.data.error, message: resolved.data.message },
      resolved.data.status,
    );
  }

  const match = await buscarCfdiPorExternalId(
    resolved.data.client as FapiClient, claimTag, nc.facturapi_claim_at,
  );
  if (match instanceof Response) return match;
  if (match?.id && match.uuid) {
    return promoverNc({
      supabase, nc, match, claimTag, user,
      apiKey: resolved.data.apiKey, ambiente: resolved.data.ambiente,
    });
  }
  return liberarClaimNc(supabase, nc, claimTag, edadMin, user);
}

async function recuperarFactura(supabase: SB, user: Usuario, facturaId: string): Promise<Response> {
  const factura = await loadFactura(supabase, facturaId);
  if (factura instanceof Response) return factura;

  if (!(await authorizeOrgRole(supabase, user.id, factura.organization_id, ROLES_EMISOR_FISCAL))) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const { claimTag, edadMin, response: validationResponse } = validarClaim(factura);
  if (validationResponse) return validationResponse;

  const resolved = await getFacturapiClient(supabase, factura.organization_id);
  if (!resolved.ok) {
    return jsonResponse(
      { error: resolved.data.error, message: resolved.data.message },
      resolved.data.status,
    );
  }

  const match = await buscarCfdiPorExternalId(
    resolved.data.client as FapiClient, claimTag, factura.facturapi_claim_at,
  );
  if (match instanceof Response) return match;
  if (match?.id && match.uuid) {
    return promoverFactura({
      supabase, factura, match, claimTag, user, ambiente: resolved.data.ambiente,
    });
  }
  return liberarClaim(supabase, factura, claimTag, edadMin, user);
}


/**
 * EF-01: la emisión de REP (`facturapi-emitir-rep`) también usa claim
 * PENDING:<uuid> + external_id; si la edge muere entre timbrar y persistir,
 * el pago queda 409 ya_timbrado_rep para siempre. Reconciliamos contra
 * FacturAPI con el mismo flujo que facturas/NC.
 */
async function recuperarPago(supabase: SB, user: Usuario, pagoId: string): Promise<Response> {
  const pago = await loadPago(supabase, pagoId);
  if (pago instanceof Response) return pago;

  if (!(await authorizeOrgRole(supabase, user.id, pago.organization_id, ROLES_EMISOR_FISCAL))) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const { claimTag, edadMin, response: validationResponse } = validarClaim(
    { facturapi_id: pago.facturapi_rep_id, facturapi_claim_at: pago.facturapi_rep_claim_at },
    "REP",
  );
  if (validationResponse) return validationResponse;

  const resolved = await getFacturapiClient(supabase, pago.organization_id);
  if (!resolved.ok) {
    return jsonResponse(
      { error: resolved.data.error, message: resolved.data.message },
      resolved.data.status,
    );
  }

  const match = await buscarCfdiPorExternalId(
    resolved.data.client as FapiClient, claimTag, pago.facturapi_rep_claim_at,
  );
  if (match instanceof Response) return match;
  if (match?.id && match.uuid) {
    return promoverPago({
      supabase, pago, match, claimTag, user,
      apiKey: resolved.data.apiKey, ambiente: resolved.data.ambiente,
    });
  }
  return liberarClaimPago(supabase, pago, claimTag, edadMin, user);
}

Deno.serve(wrapEdgeHandler("facturapi-recuperar-claim", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return jsonResponse({ error: "unauthorized" }, 401);
  const user = { id: userData.user.id, email: userData.user.email };

  const body = (await req.json().catch(() => ({}))) as ReqBody;

  if (body.nota_credito_id) return recuperarNotaCredito(supabase, user, body.nota_credito_id);
  if (body.factura_id) return recuperarFactura(supabase, user, body.factura_id);
  if (body.pago_id) return recuperarPago(supabase, user, body.pago_id);
  return jsonResponse({ error: "factura_id_o_nota_credito_id_o_pago_id_required" }, 400);
}));
