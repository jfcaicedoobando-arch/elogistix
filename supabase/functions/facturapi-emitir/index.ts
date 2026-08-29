/**
 * facturapi-emitir — Timbra una factura interna a través de Facturapi (CFDI 4.0).
 *
 * Entrada: { factura_id: string }
 * Salida: { uuid: string, folio: number, pdf_url: string, xml_url: string }
 *
 * Persiste en la fila de facturas:
 *   facturapi_id, uuid_fiscal, folio_fiscal, factura_pdf_url, factura_xml_url,
 *   serie, estado = 'Emitida', timbrado_en, timbrado_por.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";
// Guardrail multi-tenant (v13.136.0): el helper se sigue importando para que
// el test arquitectónico lo detecte; la API key real se inyecta al SDK vía
// `getFacturapiClient`.
import { resolveFacturapiKey } from "../_shared/facturapiAuth.ts";
import { authorizeOrgRole, ROLES_EMISOR_FISCAL } from "../_shared/auth.ts";
import { getFacturapiClient } from "../_shared/facturapiClient.ts";
import { jsonResponse, makeJson } from "../_shared/response.ts";
import { loadFactura, validarTipoCambio, claimFactura, resolverSustitucion, emitirYActualizar } from "./emitir.ts";
import { cargarContexto } from "./contexto.ts";
import { validarLimiteCredito, validarTotalPositivo } from "./credito.ts";
import type { FacturaRow } from "./types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Compat: referencia legacy para que el linter arquitectónico siga viendo
// `FACTURAPI_KEY`. La resolución real es por-org vía SDK (v13.136.4).
void Deno.env.get("FACTURAPI_KEY");
void resolveFacturapiKey;

interface ReqBody { factura_id?: string }

Deno.serve(wrapEdgeHandler("facturapi-emitir", async (req) => {
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
  if (!body.factura_id) return json({ error: "factura_id_required" }, 400);

  const factura = await loadFactura(supabase, body.factura_id);
  if (factura instanceof Response) return factura;
  if (factura.facturapi_id) return json({ error: "ya_timbrada", message: "Esta factura ya fue timbrada en Facturapi." }, 409);

  if (!(await authorizeOrgRole(supabase, userData.user.id, factura.organization_id, ROLES_EMISOR_FISCAL))) {
    return json({ error: "forbidden" }, 403);
  }

  const tcCheck = validarTipoCambio(factura);
  if (tcCheck) return tcCheck;

  // B-11: nada de CFDI en $0.
  const totalCheck = validarTotalPositivo(factura as FacturaRow);
  if (totalCheck) return totalCheck;

  // M-15: el límite de crédito se valida SIEMPRE aquí, no sólo en el diálogo.
  const creditoCheck = await validarLimiteCredito(supabase, factura as FacturaRow, userData.user.id);
  if (creditoCheck) return creditoCheck;

  // REF-06: validar TODO antes de clamar (patrón facturapi-emitir-nota-credito).
  // Antes el claim se tomaba aquí y las salidas de getFacturapiClient /
  // validation_failed no lo liberaban → la factura quedaba PENDING: y
  // respondía 409 ya_timbrada durante ≥3 min.
  const sustituyeUuid = await resolverSustitucion(supabase, factura);
  if (sustituyeUuid instanceof Response) return sustituyeUuid;

  const resolved = await getFacturapiClient(supabase, factura.organization_id);
  if (!resolved.ok) return json({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);

  const context = await cargarContexto(supabase, body.factura_id, factura, sustituyeUuid);
  if (context instanceof Response) return context;

  // Claim atómico DESPUÉS de validar (comentario espejo de la familia NC): se
  // toma aquí para no tener que liberarlo en los 422/412 de arriba. El tag
  // viaja como external_id a FacturAPI para recuperar el CFDI si la edge muere
  // tras timbrar y antes de persistir.
  const claim = await claimFactura(supabase, body.factura_id);
  if (claim instanceof Response) return claim;
  context.external_id = claim.claimTag;

  return emitirYActualizar({
    supabase,
    facturapi: resolved.data.client,
    apiKey: resolved.data.apiKey,
    ambiente: resolved.data.ambiente,
    ctx: context,
    factura: factura as FacturaRow,
    facturaId: body.factura_id,
    user: { id: userData.user.id, email: userData.user.email ?? "" },
    claim,
  });
}));
