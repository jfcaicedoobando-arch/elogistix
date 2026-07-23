/**
 * Lógica de negocio de `facturapi-emitir` extraída para que `index.ts` cumpla
 * con el límite de líneas y funciones. No contiene routing ni HTTP.
 */
import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getFacturapiClient, describeFacturapiError, withFacturapiTimeout, FacturapiTimeoutError, type FacturapiClient } from "../_shared/facturapiClient.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse } from "../_shared/response.ts";
import {
  FACTURAPI_BASE, buildFacturapiPayload, validateContext,
  type FacturaContext,
} from "./helpers.ts";
import { respaldarXmlEmitido } from "./respaldarXml.ts";

export interface FacturaRow {
  id: string;
  numero?: string | null;
  serie?: string | null;
  estado?: string | null;
  moneda?: string | null;
  tipo_cambio?: number | string | null;
  uso_cfdi?: string | null;
  forma_pago?: string | null;
  metodo_pago?: string | null;
  cliente_id: string;
  rfc_cliente?: string | null;
  organization_id: string;
  facturapi_id?: string | null;
  sustituye_a?: string | null;
  embarque_id?: string | null;
  expediente?: string | null;
  referencia_bl?: string | null;
}

interface ClienteRow { id: string; nombre: string; rfc?: string | null; codigo_postal?: string | null; regimen_fiscal?: string | null; uso_cfdi_default?: string | null }
interface ConceptoRow {
  descripcion: string; cantidad: number | string; precio_unitario: number | string;
  clave_sat?: string | null; clave_unidad?: string | null; tipo_iva?: string | null;
  tasa_iva_aplicada?: number | string | null; tasa_ret_isr?: number | string | null; tasa_ret_iva?: number | string | null;
}
interface UserIdentity { id: string; email?: string | null }
export interface Claim { claimTag: string; claimAt: string; release: () => Promise<void> }
interface EmitirInput { supabase: SupabaseClient; facturapi: FacturapiClient; apiKey: string; ambiente: string; ctx: FacturaContext; factura: FacturaRow; facturaId: string; user: UserIdentity; claim: Claim }

export async function loadFactura(supabase: SupabaseClient, facturaId: string): Promise<FacturaRow | Response> {
  const { data: factura, error: fErr } = await supabase
    .from("facturas")
    .select("id, numero, serie, estado, moneda, tipo_cambio, uso_cfdi, forma_pago, metodo_pago, cliente_id, rfc_cliente, organization_id, facturapi_id, sustituye_a, embarque_id, expediente, referencia_bl")
    .eq("id", facturaId)
    .maybeSingle();
  if (fErr || !factura) return jsonResponse({ error: "factura_not_found", detail: fErr?.message }, 404);
  return factura as FacturaRow;
}

export function validarTipoCambio(factura: FacturaRow): Response | null {
  const monedaFactura = factura.moneda ?? "MXN";
  const tcFactura = factura.tipo_cambio == null ? null : Number(factura.tipo_cambio);
  const tcInvalido = tcFactura == null || !Number.isFinite(tcFactura) || tcFactura <= 0 || tcFactura === 1;
  if (monedaFactura !== "MXN" && tcInvalido) {
    return jsonResponse({ error: "tipo_cambio_requerido", message: `Captura el tipo de cambio del día (DOF) antes de timbrar la factura en ${monedaFactura}.` }, 422);
  }
  return null;
}

export async function claimFactura(supabase: SupabaseClient, facturaId: string): Promise<Claim | Response> {
  const claimTag = `PENDING:${crypto.randomUUID()}`;
  const claimAt = new Date().toISOString();
  const { data: claimed, error: claimErr } = await supabase
    .from("facturas")
    .update({ facturapi_id: claimTag, facturapi_claim_at: claimAt })
    .eq("id", facturaId)
    .is("facturapi_id", null)
    .select("id")
    .maybeSingle();
  if (claimErr) return jsonResponse({ error: "claim_failed", detail: claimErr.message }, 500);
  if (!claimed) return jsonResponse({ error: "ya_timbrada", message: "Otro usuario ya está timbrando esta factura." }, 409);
  const release = async () => { await supabase.from("facturas").update({ facturapi_id: null, facturapi_claim_at: null }).eq("id", facturaId).eq("facturapi_id", claimTag); };
  return { claimTag, claimAt, release };
}

export async function resolverSustitucion(supabase: SupabaseClient, factura: FacturaRow, release: () => Promise<void>): Promise<string | Response | null> {
  if (!factura.sustituye_a) return null;
  const { data: prev } = await supabase.from("facturas").select("uuid_fiscal").eq("id", factura.sustituye_a).maybeSingle();
  if (!prev?.uuid_fiscal) { await release(); return jsonResponse({ error: "sustituida_sin_uuid", message: "La factura sustituida no tiene UUID fiscal." }, 422); }
  return prev.uuid_fiscal as string;
}

export async function cargarContexto(
  supabase: SupabaseClient, facturaId: string, factura: FacturaRow, sustituyeUuid: string | null, claimTag: string,
): Promise<FacturaContext | Response> {
  const base = await cargarBaseContexto(supabase, facturaId, factura);
  if (base instanceof Response) return base;
  const refs = await cargarReferenciasEmbarque(supabase, factura);
  const ctx: FacturaContext = {
    serie: factura.serie ?? null,
    forma_pago: factura.forma_pago ?? "",
    metodo_pago: factura.metodo_pago ?? "PUE",
    uso_cfdi: factura.uso_cfdi ?? base.cliente.uso_cfdi_default ?? "",
    moneda: factura.moneda ?? "MXN",
    tipo_cambio: Number(factura.tipo_cambio ?? 1),
    receptor: { legal_name: base.cliente.nombre, tax_id: factura.rfc_cliente ?? base.cliente.rfc ?? "", tax_system: base.cliente.regimen_fiscal ?? "", address: { zip: base.cliente.codigo_postal ?? "" }, email: base.contactoEmail },
    conceptos: base.conceptos,
    sustituye_uuid: sustituyeUuid,
    referencias: refs,
    external_id: claimTag,
  };

  const issues = validateContext(ctx);
  if (issues.length > 0) return jsonResponse({ error: "validation_failed", issues }, 422);
  return ctx;
}

interface BaseContexto {
  cliente: ClienteRow;
  contactoEmail: string | null;
  conceptos: FacturaContext["conceptos"];
}

async function cargarBaseContexto(supabase: SupabaseClient, facturaId: string, factura: FacturaRow): Promise<BaseContexto | Response> {
  const { data: cliente, error: cErr } = await supabase
    .from("clientes")
    .select("id, nombre, rfc, codigo_postal, regimen_fiscal, uso_cfdi_default")
    .eq("id", factura.cliente_id)
    .maybeSingle();
  if (cErr || !cliente) return jsonResponse({ error: "cliente_not_found", detail: cErr?.message }, 404);

  const { data: conceptos, error: conErr } = await supabase
    .from("conceptos_factura")
    .select("descripcion, cantidad, precio_unitario, clave_sat, clave_unidad, tipo_iva, tasa_iva_aplicada, tasa_ret_isr, tasa_ret_iva")
    .eq("factura_id", facturaId);
  if (conErr) return jsonResponse({ error: "conceptos_query_failed", detail: conErr.message }, 500);

  const conceptosSinClave = (conceptos ?? []).filter((c) => !c.clave_sat || String(c.clave_sat).trim() === "");
  if (conceptosSinClave.length > 0) {
    return jsonResponse({ error: "clave_sat_faltante", message: `Hay ${conceptosSinClave.length} concepto(s) sin clave SAT (c_ClaveProdServ). Asigna la clave correcta antes de timbrar.` }, 422);
  }

  const { data: contactoData } = await supabase
    .from("contactos_cliente")
    .select("email")
    .eq("cliente_id", factura.cliente_id)
    .eq("es_principal", true)
    .maybeSingle();

  return {
    cliente,
    contactoEmail: contactoData?.email ?? null,
    conceptos: (conceptos ?? []).map((c) => ({
      descripcion: c.descripcion, cantidad: Number(c.cantidad), precio_unitario: Number(c.precio_unitario), clave_sat: c.clave_sat,
      clave_unidad: c.clave_unidad ?? "E48", unidad: "Unidad de servicio",
      tipo_iva: (c.tipo_iva as "gravado_16" | "tasa_0" | "exento" | null) ?? "gravado_16",
      tasa_iva: c.tasa_iva_aplicada != null ? Number(c.tasa_iva_aplicada) : 0.16,
      tasa_ret_isr: c.tasa_ret_isr != null ? Number(c.tasa_ret_isr) : 0,
      tasa_ret_iva: c.tasa_ret_iva != null ? Number(c.tasa_ret_iva) : 0,
    })),
  };
}

async function cargarReferenciasEmbarque(supabase: SupabaseClient, factura: FacturaRow): Promise<FacturaContext["referencias"]> {
  let refExpediente: string | null = factura.expediente ?? null;
  let refBlMaster: string | null = null;
  let refBlHouse: string | null = factura.referencia_bl ?? null;
  if (factura.embarque_id) {
    const { data: emb } = await supabase.from("embarques").select("expediente, bl_master, bl_house").eq("id", factura.embarque_id).maybeSingle();
    if (emb) { refExpediente = emb.expediente ?? refExpediente; refBlMaster = emb.bl_master ?? null; refBlHouse = emb.bl_house ?? refBlHouse; }
  }
  return { expediente: refExpediente, bl_master: refBlMaster, bl_house: refBlHouse };
}

interface FapiInvoice { id: string; uuid: string; folio_number?: number; folio?: number; series?: string }

async function createInvoiceInFacturapi(
  input: EmitirInput,
  payload: ReturnType<typeof buildFacturapiPayload>,
): Promise<FapiInvoice | Response> {
  const { supabase, facturapi, factura, facturaId, user, claim } = input;
  try {
    // FIX-04/32 — timeout defensivo: si FacturApi cuelga, liberamos el claim
    // y devolvemos 504 en vez de dejar la Edge Function ocupada 150 s.
    return await withFacturapiTimeout("invoices.create", facturapi.invoices.create(payload)) as FapiInvoice;
  } catch (err) {
    await claim.release();
    if (err instanceof FacturapiTimeoutError) {
      await registrarBitacoraEdge(supabase, {
        organizationId: factura.organization_id, usuarioId: user.id, usuarioEmail: user.email, modulo: "facturacion",
        accion: "facturapi_emitir_timeout", entidadId: facturaId, entidadNombre: factura.numero ?? "",
        detalles: { op: err.op, timeout_ms: err.timeoutMs },
      });
      return jsonResponse({ error: "facturapi_timeout", message: err.message, timeout_ms: err.timeoutMs }, 504);
    }
    const { status, detail } = describeFacturapiError(err);
    await registrarBitacoraEdge(supabase, {
      organizationId: factura.organization_id, usuarioId: user.id, usuarioEmail: user.email, modulo: "facturacion",
      accion: "facturapi_emitir_failed", entidadId: facturaId, entidadNombre: factura.numero ?? "",
      detalles: { status, response: detail },
    });
    const message = (detail && typeof detail === "object" && "message" in (detail as Record<string, unknown>) && typeof (detail as Record<string, unknown>).message === "string") ? (detail as Record<string, string>).message : `FacturApi respondió ${status}`;
    return jsonResponse({ error: "facturapi_error", status, detail, message }, 502);
  }
}

interface TimbradoResultado {
  facturapiId: string;
  uuid: string;
  folio: number;
  serie: string;
  numero: string;
  pdfUrl: string;
  xmlUrl: string;
}

function parseInvoiceResult(invoice: FapiInvoice, ctx: FacturaContext): TimbradoResultado {
  const facturapiId = invoice.id;
  const uuid = invoice.uuid;
  const folio = invoice.folio_number ?? invoice.folio ?? 0;
  const serie = invoice.series ?? ctx.serie ?? "";
  const numero = `${serie}${folio}`;
  const pdfUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/pdf`;
  const xmlUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/xml`;
  return { facturapiId, uuid, folio, serie, numero, pdfUrl, xmlUrl };
}

async function persistirFacturaTimbrada(
  input: EmitirInput,
  resultado: TimbradoResultado,
  respaldo: Awaited<ReturnType<typeof respaldarXmlEmitido>>,
): Promise<Response | null> {
  const { supabase, factura, facturaId, user, claim } = input;
  const { facturapiId, uuid, folio, serie, numero, pdfUrl, xmlUrl } = resultado;

  const { error: updErr, data: updRow } = await supabase
    .from("facturas")
    .update({
      numero, facturapi_id: facturapiId, facturapi_claim_at: null, uuid_fiscal: uuid,
      folio_fiscal: folio, serie, factura_pdf_url: pdfUrl, factura_xml_url: xmlUrl,
      factura_xml_backup_path: respaldo.path, estado: "Emitida", ambiente: input.ambiente,
      timbrado_en: new Date().toISOString(), timbrado_por: user.id,
    })
    .eq("id", facturaId)
    .eq("facturapi_id", claim.claimTag)
    .select("id")
    .maybeSingle();

  if (updErr) return jsonResponse({ error: "db_update_failed", detail: updErr.message }, 500);
  if (!updRow) return jsonResponse({ error: "claim_perdido", message: "El claim de timbrado se perdió; verifica el estado en Facturapi.", facturapi_id: facturapiId, uuid }, 409);

  // Al timbrar una SUSTITUTA, dejar la relación bidireccional en la original.
  // Sin esto, cuando la original se cancela asíncronamente vía cron
  // (facturapi-reconciliar-cancelaciones) no se detecta que es sustitución
  // y se limpia la proforma incorrectamente (ver bug histórico PRO-2026-0970).
  if (factura.sustituye_a) {
    await supabase
      .from("facturas")
      .update({ sustituida_por: facturaId })
      .eq("id", factura.sustituye_a)
      .is("sustituida_por", null);
  }

  await registrarBitacoraEdge(supabase, {
    organizationId: factura.organization_id, usuarioId: user.id, usuarioEmail: user.email, modulo: "facturacion",
    accion: "facturapi_emitida", entidadId: facturaId, entidadNombre: numero,
    detalles: { uuid, folio, serie, facturapi_id: facturapiId, xml_backup: { status: respaldo.status, path: respaldo.path, error: respaldo.error ?? null } },
  });

  return null;
}

export async function emitirYActualizar(input: EmitirInput): Promise<Response> {
  const { supabase, apiKey, ctx, factura, facturaId } = input;
  const payload = buildFacturapiPayload(ctx);

  const invoice = await createInvoiceInFacturapi(input, payload);
  if (invoice instanceof Response) return invoice;

  const resultado = parseInvoiceResult(invoice, ctx);
  const respaldo = await respaldarXmlEmitido({
    supabase, apiKey, facturapiId: resultado.facturapiId,
    organizationId: factura.organization_id, facturaId, uuid: resultado.uuid,
  });

  const persistError = await persistirFacturaTimbrada(input, resultado, respaldo);
  if (persistError) return persistError;

  return jsonResponse({
    uuid: resultado.uuid, folio: resultado.folio, serie: resultado.serie,
    facturapi_id: resultado.facturapiId, pdf_url: resultado.pdfUrl, xml_url: resultado.xmlUrl, xml_backup: respaldo,
  });
}
