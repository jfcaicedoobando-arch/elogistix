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
import { getFacturapiClient, describeFacturapiError } from "../_shared/facturapiClient.ts";
import {
  buildNcPayload, validateNcContext,
  type NotaCreditoContext, type ConceptoNC,
} from "./helpers.ts";

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

  const { data: nc, error: ncErr } = await supabase
    .from("factura_notas_credito")
    .select("id, factura_id, organization_id, serie, uso_cfdi, forma_pago, moneda, tipo_cambio, conceptos, facturapi_id, estado")
    .eq("id", body.nota_credito_id)
    .maybeSingle();
  if (ncErr || !nc) return json({ error: "nota_credito_not_found", detail: ncErr?.message }, 404);
  if (nc.facturapi_id) return json({ error: "ya_timbrada", message: "Esta nota de crédito ya fue timbrada." }, 409);

  const { data: factura, error: fErr } = await supabase
    .from("facturas")
    .select("id, uuid_fiscal, cliente_id, rfc_cliente, uso_cfdi, forma_pago")
    .eq("id", nc.factura_id)
    .maybeSingle();
  if (fErr || !factura) return json({ error: "factura_not_found", detail: fErr?.message }, 404);
  if (!factura.uuid_fiscal) {
    return json({
      error: "factura_sin_uuid",
      message: "La factura original no tiene UUID fiscal. Timbra la factura primero.",
    }, 409);
  }

  const { data: cliente, error: cErr } = await supabase
    .from("clientes")
    .select("id, nombre, rfc, codigo_postal, regimen_fiscal, uso_cfdi_default")
    .eq("id", factura.cliente_id)
    .maybeSingle();
  if (cErr || !cliente) return json({ error: "cliente_not_found", detail: cErr?.message }, 404);

  const { data: contactoData } = await supabase
    .from("contactos_cliente")
    .select("email")
    .eq("cliente_id", factura.cliente_id)
    .eq("es_principal", true)
    .maybeSingle();

  const resolved = await getFacturapiClient(supabase, nc.organization_id);
  if (!resolved.ok) return json({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);
  const facturapi = resolved.data.client;

  const conceptos = (Array.isArray(nc.conceptos) ? nc.conceptos : []) as ConceptoNC[];

  const ctx: NotaCreditoContext = {
    serie: nc.serie ?? null,
    // SAT recomienda G02 para devoluciones, pero respetamos el valor del cliente/factura.
    uso_cfdi: nc.uso_cfdi ?? factura.uso_cfdi ?? cliente.uso_cfdi_default ?? "G02",
    forma_pago: nc.forma_pago ?? factura.forma_pago ?? "",
    moneda: nc.moneda ?? "MXN",
    tipo_cambio: Number(nc.tipo_cambio ?? 1),
    uuid_factura_relacionada: factura.uuid_fiscal,
    receptor: {
      legal_name: cliente.nombre,
      tax_id: factura.rfc_cliente ?? cliente.rfc ?? "",
      tax_system: cliente.regimen_fiscal ?? "",
      address: { zip: cliente.codigo_postal ?? "" },
      email: contactoData?.email ?? null,
    },
    conceptos,
  };

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
      detalle: { status, response: detail },
    });
    return json({ error: "facturapi_error", status, detail }, 502);
  }

  const facturapiId = invoice.id;
  const uuid = invoice.uuid;
  const folio = invoice.folio_number ?? invoice.folio ?? 0;
  const serieTimbrada = invoice.series ?? ctx.serie ?? "";
  const pdfUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/pdf`;
  const xmlUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/xml`;

  const { error: updErr } = await supabase
    .from("factura_notas_credito")
    .update({
      facturapi_id: facturapiId,
      uuid_fiscal: uuid,
      folio_fiscal: folio,
      serie: serieTimbrada,
      pdf_url: pdfUrl,
      xml_url: xmlUrl,
      estado: "Timbrada",
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
    detalle: { uuid, folio, serie: serieTimbrada, facturapi_id: facturapiId, factura_id: nc.factura_id },
  });

  return json({ uuid, folio, serie: serieTimbrada, facturapi_id: facturapiId, pdf_url: pdfUrl, xml_url: xmlUrl });
}));
