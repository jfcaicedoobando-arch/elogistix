/**
 * facturapi-consultar — Consulta en vivo el estado de una factura en FacturApi
 * (`GET /v2/invoices/{id}`) y reconcilia la BD local si detecta divergencia.
 *
 * Sólo lectura desde el punto de vista del usuario: no cancela ni timbra.
 * Devuelve un objeto con lo que ve FacturApi (`status`, `cancellation_status`,
 * `canceled_at`, `related_documents`) + lo que tenemos en BD + un flag
 * `divergencia` para que la UI resalte diferencias.
 *
 * Entrada: { factura_id: string }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handlePreflightStrict } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";
import { authorizeOrgRole, ROLES_CONSULTA_FISCAL } from "../_shared/auth.ts";
import { makeJson } from "../_shared/response.ts";
import {
  buildResponse,
  computeDivergencias,
  fetchRemote,
  loadFactura,
  reconciliarSiAplica,
  verificarDocumentos,
} from "./reconciliacion.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function handle(req: Request): Promise<Response> {
  // EF-10: endpoints con JWT usan CORS de whitelist (guía _shared/cors.ts).
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const json = makeJson(req);
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userData.user) return json({ error: "unauthorized" }, 401);

  const body = (await req.json().catch(() => ({}))) as { factura_id?: string };
  if (!body.factura_id) return json({ error: "factura_id_required" }, 400);

  const loaded = await loadFactura(supabase, body.factura_id);
  if (!loaded.ok) return loaded.res;
  const factura = loaded.factura;

  if (!(await authorizeOrgRole(supabase, userData.user.id, factura.organization_id, ROLES_CONSULTA_FISCAL))) {
    return json({ error: "forbidden" }, 403);
  }

  const fetched = await fetchRemote(supabase, factura);
  if (!fetched.ok) return fetched.res;
  const remote = fetched.remote;

  const user = { id: userData.user.id, email: userData.user.email };
  const divergencias = computeDivergencias(remote, factura);
  const reconciliada = await reconciliarSiAplica(supabase, factura, remote, divergencias, user);

  const documental = await verificarDocumentos(supabase, factura, user);
  const todas = [...divergencias, ...documental.divergencias];

  return json({
    ...buildResponse(factura, remote, todas, reconciliada),
    xml: documental.xml,
    reps: documental.reps,
  });
}

Deno.serve(wrapEdgeHandler("facturapi-consultar", handle));
