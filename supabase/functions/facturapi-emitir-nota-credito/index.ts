/**
 * facturapi-emitir-nota-credito — Timbra una Nota de Crédito (CFDI tipo E)
 * en FacturApi, relacionada a la factura original vía UUID.
 *
 * Entrada: { nota_credito_id: string }
 * Salida: { uuid, folio, serie, facturapi_id, pdf_url, xml_url }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";
import { resolveFacturapiKey } from "../_shared/facturapiAuth.ts";
import { getFacturapiClient, describeFacturapiError, extractFacturapiMessage } from "../_shared/facturapiClient.ts";
import { buildNcPayload, validateNcContext } from "./helpers.ts";
import { preloadNcContext, buildNcContextFromRows } from "./data.ts";
import { respaldarXmlTimbrado } from "../_shared/respaldarXmlTimbrado.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";


const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
void Deno.env.get("FACTURAPI_KEY");
void resolveFacturapiKey;

const FACTURAPI_BASE = "https://www.facturapi.io/v2";

interface ReqBody { nota_credito_id?: string }

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(wrapEdgeHandler("facturapi-emitir-nota-credito", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userData.user) return json({ error: "unauthorized" }, 401);

  const body = (await req.json().catch(() => ({}))) as ReqBody;
  if (!body.nota_credito_id) return json({ error: "nota_credito_id_required" }, 400);

  const pre = await preloadNcContext(supabase, body.nota_credito_id);
  if (!pre.ok) return json(pre.body, pre.status);
  const { nc, factura, cliente, email } = pre;


  const resolved = await getFacturapiClient(supabase, nc.organization_id);
  if (!resolved.ok) return json({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);
  const facturapi = resolved.data.client;

  const ctx = buildNcContextFromRows(nc, factura, cliente, email);
  const issues = validateNcContext(ctx);
  if (issues.length > 0) return json({ error: "validation_failed", issues }, 422);

  const payload = buildNcPayload(ctx);

  interface FapiInvoice { id: string; uuid: string; folio_number?: number; folio?: number; series?: string }
  let invoice: FapiInvoice;
  try {
    invoice = await facturapi.invoices.create(payload) as FapiInvoice;
  } catch (err) {
    const { status, detail } = describeFacturapiError(err);
    await supabase.from("bitacora_actividad").insert({
      organization_id: nc.organization_id,
      user_id: userData.user.id,
      accion: "facturapi_nc_emitir_failed",
      entidad: "factura_nota_credito",
      entidad_id: body.nota_credito_id,
      detalles: { status, response: detail },
    });
    const message = extractFacturapiMessage(detail, status);
    return json({ error: "facturapi_error", status, detail, message }, 502);
  }

  const facturapiId = invoice.id;
  const uuid = invoice.uuid;
  const folio = invoice.folio_number ?? invoice.folio ?? 0;
  const serieTimbrada = invoice.series ?? ctx.serie ?? "";
  const pdfUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/pdf`;
  const xmlUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/xml`;

  // Ola 3 · Item 5 — Respaldo automático del XML timbrado (best-effort).
  const respaldo = await respaldarXmlTimbrado({
    supabase,
    apiKey: resolved.data.apiKey,
    facturapiId,
    organizationId: nc.organization_id,
    uuid,
    folder: "notas-credito",
  });

  const { error: updErr } = await supabase
    .from("factura_notas_credito")
    .update({
      facturapi_id: facturapiId,
      uuid_fiscal: uuid,
      folio_fiscal: folio,
      serie: serieTimbrada,
      pdf_url: pdfUrl,
      xml_url: xmlUrl,
      xml_backup_path: respaldo.path,
      estado: "Timbrada",
      ambiente: resolved.data.ambiente,
      timbrado_en: new Date().toISOString(),
      timbrado_por: userData.user.id,
    })
    .eq("id", body.nota_credito_id);
  if (updErr) return json({ error: "db_update_failed", detail: updErr.message }, 500);

  await supabase.from("bitacora_actividad").insert({
    organization_id: nc.organization_id,
    user_id: userData.user.id,
    accion: "facturapi_nc_emitida",
    entidad: "factura_nota_credito",
    entidad_id: body.nota_credito_id,
    detalles: {
      uuid, folio, serie: serieTimbrada, facturapi_id: facturapiId, factura_id: nc.factura_id,
      xml_backup: { status: respaldo.status, path: respaldo.path, error: respaldo.error ?? null },
    },
  });

  return json({ uuid, folio, serie: serieTimbrada, facturapi_id: facturapiId, pdf_url: pdfUrl, xml_url: xmlUrl, xml_backup: respaldo });
}));
