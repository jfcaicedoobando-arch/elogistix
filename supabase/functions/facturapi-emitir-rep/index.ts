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
import { corsHeaders } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";

import { resolveFacturapiKey } from "../_shared/facturapiAuth.ts";
import { getFacturapiClient, describeFacturapiError } from "../_shared/facturapiClient.ts";
import { buildRepPayload, validateRepContext, type PagoContext } from "./helpers.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Compat legacy `FACTURAPI_KEY` — multi-tenant resuelto vía SDK (v13.136.4).
void Deno.env.get("FACTURAPI_KEY");
void resolveFacturapiKey;

interface ReqBody { pago_id?: string }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// eslint-disable-next-line complexity
Deno.serve(wrapEdgeHandler("facturapi-emitir-rep", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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

  // 1) Pago
  const { data: pago, error: pErr } = await supabase
    .from("pagos_factura")
    .select("id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, forma_pago, referencia, estado_rep, facturapi_rep_id, monto_aplicado_factura")
    .eq("id", body.pago_id)
    .maybeSingle();
  if (pErr || !pago) return json({ error: "pago_not_found", detail: pErr?.message }, 404);
  if (pago.facturapi_rep_id) return json({ error: "ya_timbrado_rep", message: "Este pago ya tiene REP timbrado." }, 409);

  // Multi-tenant: instanciar SDK de FacturApi para esta organización (v13.136.4).
  const resolved = await getFacturapiClient(supabase, pago.organization_id);
  if (!resolved.ok) return json({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);
  const facturapi = resolved.data.client;


  // 2) Factura
  const { data: factura, error: fErr } = await supabase
    .from("facturas")
    .select("id, numero, serie, total, moneda, tipo_cambio, metodo_pago, uuid_fiscal, folio_fiscal, cliente_id, rfc_cliente")
    .eq("id", pago.factura_id)
    .maybeSingle();
  if (fErr || !factura) return json({ error: "factura_not_found", detail: fErr?.message }, 404);
  if (!factura.uuid_fiscal) return json({ error: "factura_no_timbrada", message: "La factura original no está timbrada." }, 409);
  if (factura.metodo_pago !== "PPD") return json({ error: "no_aplica_rep", message: "La factura no es PPD; no requiere REP." }, 409);

  // 3) Cliente
  const { data: cliente, error: cErr } = await supabase
    .from("clientes")
    .select("id, nombre, rfc, codigo_postal, regimen_fiscal")
    .eq("id", factura.cliente_id)
    .maybeSingle();
  if (cErr || !cliente) return json({ error: "cliente_not_found", detail: cErr?.message }, 404);

  const { data: contactoData } = await supabase
    .from("contactos_cliente")
    .select("email")
    .eq("cliente_id", factura.cliente_id)
    .eq("es_principal", true)
    .maybeSingle();

  // 4) Pagos previos de la misma factura para calcular num_parcialidad e imp_saldo_ant
  const { data: pagosPrev, error: ppErr } = await supabase
    .from("pagos_factura")
    .select("id, fecha_pago, monto_aplicado_factura, created_at")
    .eq("factura_id", factura.id)
    .is("deleted_at", null)
    .order("fecha_pago", { ascending: true })
    .order("created_at", { ascending: true });
  if (ppErr) return json({ error: "pagos_query_failed", detail: ppErr.message }, 500);

  const totalFactura = Number(factura.total ?? 0);
  let acumuladoAntes = 0;
  let numParcialidad = 1;
  for (const pp of pagosPrev ?? []) {
    if (pp.id === pago.id) break;
    acumuladoAntes += Number(pp.monto_aplicado_factura ?? 0);
    numParcialidad += 1;
  }
  const saldoAnt = round2(totalFactura - acumuladoAntes);
  const impPagado = Number(pago.monto_aplicado_factura ?? 0);
  const saldoInsoluto = round2(saldoAnt - impPagado);

  // 5) Construir contexto
  const ctx: PagoContext = {
    receptor: {
      legal_name: cliente.nombre,
      tax_id: factura.rfc_cliente ?? cliente.rfc ?? "",
      tax_system: cliente.regimen_fiscal ?? "",
      address: { zip: cliente.codigo_postal ?? "" },
      email: contactoData?.email ?? null,
    },
    fecha_pago: typeof pago.fecha_pago === "string" ? pago.fecha_pago : new Date(pago.fecha_pago as unknown as string).toISOString(),
    forma_pago: pago.forma_pago ?? "",
    moneda: pago.moneda ?? "MXN",
    tipo_cambio: Number(pago.tipo_cambio ?? 1),
    monto: Number(pago.monto ?? 0),
    numero_operacion: pago.referencia ?? null,
    documento_relacionado: {
      uuid: factura.uuid_fiscal,
      folio: factura.folio_fiscal != null ? String(factura.folio_fiscal) : null,
      serie: factura.serie ?? null,
      moneda_dr: factura.moneda ?? "MXN",
      tipo_cambio_dr: Number(factura.tipo_cambio ?? 1),
      num_parcialidad: numParcialidad,
      imp_saldo_ant: saldoAnt,
      imp_pagado: impPagado,
      imp_saldo_insoluto: saldoInsoluto,
      metodo_pago: "PPD",
      tasa_iva: 0.16,
    },
  };

  const issues = validateRepContext(ctx);
  if (issues.length > 0) {
    await supabase.from("pagos_factura")
      .update({ estado_rep: "Error", rep_error: issues.map((i) => i.message).join("; ") })
      .eq("id", pago.id);
    return json({ error: "validation_failed", issues }, 422);
  }

  const payload = buildRepPayload(ctx);

  const fapiRes = await fetch(`${FACTURAPI_BASE}/invoices`, {
    method: "POST",
    headers: {
      "Authorization": basicAuthHeader(FACTURAPI_KEY),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const fapiJson = await fapiRes.json().catch(() => ({}));
  if (!fapiRes.ok) {
    const errMsg = typeof fapiJson === "object" && fapiJson !== null
      ? JSON.stringify(fapiJson).slice(0, 500)
      : "Facturapi error";
    await supabase.from("pagos_factura")
      .update({ estado_rep: "Error", rep_error: errMsg })
      .eq("id", pago.id);
    await supabase.from("bitacora_actividad").insert({
      organization_id: pago.organization_id,
      user_id: userData.user.id,
      accion: "facturapi_rep_emitir_failed",
      entidad: "pago_factura",
      entidad_id: pago.id,
      detalle: { status: fapiRes.status, response: fapiJson },
    });
    return json({ error: "facturapi_error", status: fapiRes.status, detail: fapiJson }, 502);
  }

  const facturapiId: string = fapiJson.id;
  const uuid: string = fapiJson.uuid;
  const folio: number = fapiJson.folio_number ?? fapiJson.folio ?? 0;
  const serieTimbrada: string = fapiJson.series ?? "";
  const pdfUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/pdf`;
  const xmlUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/xml`;

  const { error: updErr } = await supabase
    .from("pagos_factura")
    .update({
      facturapi_rep_id: facturapiId,
      uuid_rep: uuid,
      folio_rep: folio,
      serie_rep: serieTimbrada,
      rep_pdf_url: pdfUrl,
      rep_xml_url: xmlUrl,
      estado_rep: "Timbrado",
      timbrado_rep_en: new Date().toISOString(),
      timbrado_rep_por: userData.user.id,
      rep_error: null,
    })
    .eq("id", pago.id);
  if (updErr) return json({ error: "db_update_failed", detail: updErr.message }, 500);

  await supabase.from("bitacora_actividad").insert({
    organization_id: pago.organization_id,
    user_id: userData.user.id,
    accion: "facturapi_rep_emitido",
    entidad: "pago_factura",
    entidad_id: pago.id,
    detalle: { uuid, folio, serie: serieTimbrada, facturapi_id: facturapiId, factura_id: factura.id },
  });

  return json({ uuid, folio, serie: serieTimbrada, facturapi_id: facturapiId, pdf_url: pdfUrl, xml_url: xmlUrl });
}));

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
