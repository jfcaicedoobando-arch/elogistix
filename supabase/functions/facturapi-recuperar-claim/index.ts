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
  loadFactura, validarClaim, buscarCfdiPorExternalId, promoverFactura, liberarClaim,
  type ReqBody, type FapiClient,
} from "./recuperar.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
  if (!body.factura_id) return jsonResponse({ error: "factura_id_required" }, 400);

  const factura = await loadFactura(supabase, body.factura_id);
  if (factura instanceof Response) return factura;

  if (!(await authorizeOrgRole(supabase, user.id, factura.organization_id, ROLES_EMISOR_FISCAL))) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const { claimTag, edadMin, response: validationResponse } = validarClaim(factura);
  if (validationResponse) return validationResponse;

  const resolved = await getFacturapiClient(supabase, factura.organization_id);
  if (!resolved.ok) return jsonResponse({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);

  const match = await buscarCfdiPorExternalId(resolved.data.client as FapiClient, claimTag, factura.facturapi_claim_at);
  if (match instanceof Response) return match;
  if (match?.id && match.uuid) {
    return promoverFactura({ supabase, factura, match, claimTag, user, ambiente: resolved.data.ambiente });
  }

  return liberarClaim(supabase, factura, claimTag, edadMin, user);
}));
