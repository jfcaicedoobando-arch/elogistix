/**
 * facturapi-emitir-rep — Timbra el Recibo Electrónico de Pago (REP / Complemento de Pagos)
 * para un pago de factura PPD a través de Facturapi (CFDI 4.0).
 *
 * Entrada: { pago_id: string }
 * Salida: { uuid: string, folio: number, serie: string, facturapi_id: string, pdf_url, xml_url }
 *
 * v13.91.0
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handlePreflightStrict } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";

import { resolveFacturapiKey } from "../_shared/facturapiAuth.ts";
import { getFacturapiClient } from "../_shared/facturapiClient.ts";
import { makeJson } from "../_shared/response.ts";
import { emitirRepCasoUso } from "./casoUso.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Compat legacy `FACTURAPI_KEY` — multi-tenant resuelto vía SDK (v13.136.4).
void Deno.env.get("FACTURAPI_KEY");
void resolveFacturapiKey;

interface ReqBody { pago_id?: string }

Deno.serve(wrapEdgeHandler("facturapi-emitir-rep", async (req) => {
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

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);

  const body = (await req.json().catch(() => ({}))) as ReqBody;
  if (!body.pago_id) return json({ error: "pago_id_required" }, 400);

  return await emitirRepCasoUso({
    supabase,
    pagoId: body.pago_id,
    usuario: { id: userData.user.id, email: userData.user.email },
    json,
    // Multi-tenant: el cliente del SDK se crea aquí (adaptador) por organización.
    resolverFacturapi: async (organizationId: string) => {
      const resolved = await getFacturapiClient(supabase, organizationId);
      if (!resolved.ok) {
        return {
          ok: false as const,
          response: json({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status),
        };
      }
      return { ok: true as const, data: resolved.data };
    },
  });
}));


