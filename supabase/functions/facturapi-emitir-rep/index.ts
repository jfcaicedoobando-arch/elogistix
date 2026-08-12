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
import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";

import { resolveFacturapiKey, FACTURAPI_BASE } from "../_shared/facturapiAuth.ts";
import { authorizeOrgRole, ROLES_COBRANZA_FISCAL } from "../_shared/auth.ts";
import { getFacturapiClient } from "../_shared/facturapiClient.ts";
import { timbrarRep } from "./timbrar.ts";
import { buildRepPayload, validateRepContext, type PagoContext } from "./helpers.ts";
import { calcularParcialidad, resolverReferenciasEmbarque, tasaIvaFacturaOriginal } from "./context.ts";
import { respaldarXmlTimbrado } from "../_shared/respaldarXmlTimbrado.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse, makeJson } from "../_shared/response.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Compat legacy `FACTURAPI_KEY` — multi-tenant resuelto vía SDK (v13.136.4).
void Deno.env.get("FACTURAPI_KEY");
void resolveFacturapiKey;

interface ReqBody { pago_id?: string }

// eslint-disable-next-line complexity
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

  // 1) Pago
  const { data: pago, error: pErr } = await supabase
    .from("pagos_factura")
    .select("id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, forma_pago, referencia, estado_rep, facturapi_rep_id, monto_aplicado_factura")
    .eq("id", body.pago_id)
    .maybeSingle();
  if (pErr || !pago) return json({ error: "pago_not_found", detail: pErr?.message }, 404);
  if (pago.facturapi_rep_id) {
    const esClaim = String(pago.facturapi_rep_id).startsWith("PENDING:");
    return json({
      error: "ya_timbrado_rep",
      message: esClaim
        ? "Hay un timbrado de REP en curso o interrumpido. Espera ~3 min y usa 'Recuperar timbrado'."
        : "Este pago ya tiene REP timbrado.",
      claim_pendiente: esClaim,
    }, 409);
  }
  if (!(await authorizeOrgRole(supabase, userData.user.id, pago.organization_id, ROLES_COBRANZA_FISCAL))) {
    return json({ error: "forbidden" }, 403);
  }

  // Multi-tenant: instanciar SDK de FacturApi para esta organización (v13.136.4).
  const resolved = await getFacturapiClient(supabase, pago.organization_id);
  if (!resolved.ok) return json({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);
  const facturapi = resolved.data.client;


  // 2) Factura
  const { data: factura, error: fErr } = await supabase
    .from("facturas")
    .select("id, numero, serie, total, subtotal, iva, moneda, tipo_cambio, metodo_pago, uuid_fiscal, folio_fiscal, cliente_id, rfc_cliente, embarque_id, expediente, referencia_bl")
    .eq("id", pago.factura_id)
    .maybeSingle();
  if (fErr || !factura) return json({ error: "factura_not_found", detail: fErr?.message }, 404);
  if (!factura.uuid_fiscal) return json({ error: "factura_no_timbrada", message: "La factura original no está timbrada." }, 409);
  if (factura.metodo_pago !== "PPD") return json({ error: "no_aplica_rep", message: "La factura no es PPD; no requiere REP." }, 409);

  // α.1 — Tasa IVA efectiva de la factura original (extraída a context.ts).
  const tasaIvaFactura = tasaIvaFacturaOriginal(Number(factura.subtotal ?? 0), Number(factura.iva ?? 0));

  // 3) Cliente
  const { data: cliente, error: cErr } = await supabase
    .from("clientes")
    .select("id, nombre, rfc, codigo_postal, regimen_fiscal")
    .eq("id", factura.cliente_id)
    .maybeSingle();
  if (cErr || !cliente) return json({ error: "cliente_not_found", detail: cErr?.message }, 404);

  // La columna `es_principal` fue removida; tomamos el contacto más antiguo con email.
  const { data: contactoData } = await supabase
    .from("contactos_cliente")
    .select("email")
    .eq("cliente_id", factura.cliente_id)
    .not("email", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
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

  const { numParcialidad, saldoAnt, impPagado, saldoInsoluto } = calcularParcialidad(
    pagosPrev, pago.id, Number(factura.total ?? 0), Number(pago.monto_aplicado_factura ?? 0),
  );

  // v13.208.0 — Referencias del embarque vinculado a la factura (con fallback a snapshot).
  const refs = await resolverReferenciasEmbarque(supabase, factura);


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
      tasa_iva: tasaIvaFactura,
    },
    referencias: refs,
  };

  const issues = validateRepContext(ctx);
  if (issues.length > 0) {
    await supabase.from("pagos_factura")
      .update({ estado_rep: "Error", rep_error: issues.map((i) => i.message).join("; ") })
      .eq("id", pago.id);
    return json({ error: "validation_failed", issues }, 422);
  }

  // EF-01 (auditoría): claim atómico ANTES de timbrar — mismo patrón que
  // claimFactura (facturapi-emitir) y claimNotaCredito. Se toma DESPUÉS de
  // validar para no liberarlo en el 422. El tag viaja como external_id a
  // Facturapi para recuperar el REP si la edge muere entre timbrar y persistir.
  const claimTag = `PENDING:${crypto.randomUUID()}`;
  const claimAt = new Date().toISOString();
  const { data: claimed, error: claimErr } = await supabase
    .from("pagos_factura")
    .update({ facturapi_rep_id: claimTag, facturapi_rep_claim_at: claimAt, rep_error: null })
    .eq("id", pago.id)
    .is("facturapi_rep_id", null)
    .select("id")
    .maybeSingle();
  if (claimErr) return json({ error: "claim_failed", detail: claimErr.message }, 500);
  if (!claimed) return json({ error: "ya_timbrado_rep", message: "Otro proceso ya está timbrando este REP." }, 409);
  const releaseClaim = async () => {
    await supabase.from("pagos_factura")
      .update({ facturapi_rep_id: null, facturapi_rep_claim_at: null })
      .eq("id", pago.id)
      .eq("facturapi_rep_id", claimTag);
  };

  const payload = buildRepPayload(ctx);
  // EF-01: correlación del claim para facturapi-recuperar-claim (Facturapi NO
  // deduplica por external_id; es sólo un campo de búsqueda).
  payload.external_id = claimTag;

  const resultado = await timbrarRep({
    facturapi,
    payload: payload as unknown as Record<string, unknown>,
    supabase,
    pagoId: pago.id,
    organizationId: pago.organization_id,
    usuarioId: userData.user.id,
    usuarioEmail: userData.user.email,
    claimTag,
    releaseClaim,
    json,
  });
  if (!resultado.ok) return resultado.response;
  const fapiJson = resultado.invoice;


  const facturapiId: string = fapiJson.id;
  const uuid: string = fapiJson.uuid;
  const folio: number = fapiJson.folio_number ?? fapiJson.folio ?? 0;
  const serieTimbrada: string = fapiJson.series ?? "";
  const pdfUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/pdf`;
  const xmlUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/xml`;

  // Ola 3 · Item 5 — Respaldo automático del XML timbrado (best-effort).
  const respaldo = await respaldarXmlTimbrado({
    supabase,
    apiKey: resolved.data.apiKey,
    facturapiId,
    organizationId: pago.organization_id,
    uuid,
    folder: "rep",
  });

  const { error: updErr, data: updRow } = await supabase
    .from("pagos_factura")
    .update({
      facturapi_rep_id: facturapiId,
      facturapi_rep_claim_at: null,
      uuid_rep: uuid,
      folio_rep: folio,
      serie_rep: serieTimbrada,
      rep_pdf_url: pdfUrl,
      rep_xml_url: xmlUrl,
      rep_xml_backup_path: respaldo.path,
      estado_rep: "Timbrado",
      ambiente: resolved.data.ambiente,
      timbrado_rep_en: new Date().toISOString(),
      timbrado_rep_por: userData.user.id,
      rep_error: null,
    })
    .eq("id", pago.id)
    // EF-01: persistir sólo si seguimos poseyendo el claim (patrón emitir/NC).
    .eq("facturapi_rep_id", claimTag)
    .select("id")
    .maybeSingle();
  if (updErr) return json({ error: "db_update_failed", detail: updErr.message }, 500);
  if (!updRow) return json({ error: "claim_perdido", message: "El claim de timbrado se perdió; usa 'Recuperar timbrado' con este pago.", facturapi_id: facturapiId, uuid }, 409);

  await registrarBitacoraEdge(supabase, {
    organizationId: pago.organization_id,
    usuarioId: userData.user.id,
    usuarioEmail: userData.user.email,
    modulo: "facturacion",
    accion: "facturapi_rep_emitido",
    entidadId: pago.id,
    detalles: {
      uuid, folio, serie: serieTimbrada, facturapi_id: facturapiId, factura_id: factura.id,
      xml_backup: { status: respaldo.status, path: respaldo.path, error: respaldo.error ?? null },
    },
  });

  return json({ uuid, folio, serie: serieTimbrada, facturapi_id: facturapiId, pdf_url: pdfUrl, xml_url: xmlUrl, xml_backup: respaldo });
}));
