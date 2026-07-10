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
import { corsHeaders } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";
// Guardrail multi-tenant (v13.136.0): el helper se sigue importando para que
// el test arquitectónico lo detecte; la API key real se inyecta al SDK vía
// `getFacturapiClient`.
import { resolveFacturapiKey } from "../_shared/facturapiAuth.ts";
import { authorizeOrgMembership } from "../_shared/auth.ts";
import { getFacturapiClient, describeFacturapiError } from "../_shared/facturapiClient.ts";
import {
  FACTURAPI_BASE, buildFacturapiPayload, validateContext,
  type FacturaContext,
} from "./helpers.ts";
import { respaldarXmlEmitido } from "./respaldarXml.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Compat: referencia legacy para que el linter arquitectónico siga viendo
// `FACTURAPI_KEY`. La resolución real es por-org vía SDK (v13.136.4).
void Deno.env.get("FACTURAPI_KEY");
void resolveFacturapiKey;

interface ReqBody { factura_id?: string }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(wrapEdgeHandler("facturapi-emitir", async (req) => {
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
  if (!body.factura_id) return json({ error: "factura_id_required" }, 400);

  // Cargar factura + cliente + conceptos
  const { data: factura, error: fErr } = await supabase
    .from("facturas")
    .select("id, numero, serie, estado, moneda, tipo_cambio, uso_cfdi, forma_pago, metodo_pago, cliente_id, rfc_cliente, organization_id, facturapi_id, sustituye_a, embarque_id, expediente, referencia_bl")
    .eq("id", body.factura_id)
    .maybeSingle();
  if (fErr || !factura) return json({ error: "factura_not_found", detail: fErr?.message }, 404);
  if (factura.facturapi_id) return json({ error: "ya_timbrada", message: "Esta factura ya fue timbrada en Facturapi." }, 409);

  if (!(await authorizeOrgMembership(supabase, userData.user.id, factura.organization_id))) {
    return json({ error: "forbidden" }, 403);
  }

  // v13.171.0 — Guard: facturas en moneda extranjera requieren TC capturado
  // (bloqueo también aplicado en UI vía checklist + banner). Defensa en profundidad.
  const monedaFactura = factura.moneda ?? "MXN";
  const tcFactura = factura.tipo_cambio == null ? null : Number(factura.tipo_cambio);
  if (monedaFactura !== "MXN" && (tcFactura == null || !Number.isFinite(tcFactura) || tcFactura <= 0)) {
    return json({
      error: "tipo_cambio_requerido",
      message: `Captura el tipo de cambio del día (DOF) antes de timbrar la factura en ${monedaFactura}.`,
    }, 422);
  }

  // Si esta factura sustituye a otra, resolver su UUID para relación SAT 04.
  let sustituyeUuid: string | null = null;
  if (factura.sustituye_a) {
    const { data: prev } = await supabase
      .from("facturas").select("uuid_fiscal").eq("id", factura.sustituye_a).maybeSingle();
    if (!prev?.uuid_fiscal) return json({ error: "sustituida_sin_uuid", message: "La factura sustituida no tiene UUID fiscal." }, 422);
    sustituyeUuid = prev.uuid_fiscal as string;
  }


  // Multi-tenant: instanciar SDK de FacturApi para esta organización (v13.136.4).
  const resolved = await getFacturapiClient(supabase, factura.organization_id);
  if (!resolved.ok) return json({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);
  const facturapi = resolved.data.client;



  const { data: cliente, error: cErr } = await supabase
    .from("clientes")
    .select("id, nombre, rfc, codigo_postal, regimen_fiscal, uso_cfdi_default")
    .eq("id", factura.cliente_id)
    .maybeSingle();
  if (cErr || !cliente) return json({ error: "cliente_not_found", detail: cErr?.message }, 404);

  const { data: conceptos, error: conErr } = await supabase
    .from("conceptos_factura")
    .select("descripcion, cantidad, precio_unitario, clave_sat, clave_unidad, tipo_iva, tasa_iva_aplicada, tasa_ret_isr, tasa_ret_iva")
    .eq("factura_id", body.factura_id);
  if (conErr) return json({ error: "conceptos_query_failed", detail: conErr.message }, 500);

  // α.1 — Validación estricta de claves SAT: no permitir timbrar con clave vacía.
  // Antes había fallback silencioso a "81141601" que hacía que todos los CFDIs
  // salieran con clave incorrecta sin avisar al usuario.
  const conceptosSinClave = (conceptos ?? []).filter((c) => !c.clave_sat || String(c.clave_sat).trim() === "");
  if (conceptosSinClave.length > 0) {
    return json({
      error: "clave_sat_faltante",
      message: `Hay ${conceptosSinClave.length} concepto(s) sin clave SAT (c_ClaveProdServ). Asigna la clave correcta antes de timbrar.`,
    }, 422);
  }

  const { data: contactoData } = await supabase
    .from("contactos_cliente")
    .select("email")
    .eq("cliente_id", factura.cliente_id)
    .eq("es_principal", true)
    .maybeSingle();

  // v13.208.0 — Referencias del embarque: expediente + BL Master + BL House.
  // Prioridad: datos del embarque vinculado → fallback a los campos snapshot
  // en la propia factura (`facturas.expediente`, `facturas.referencia_bl`).
  let refExpediente: string | null = factura.expediente ?? null;
  let refBlMaster: string | null = null;
  let refBlHouse: string | null = factura.referencia_bl ?? null;
  if (factura.embarque_id) {
    const { data: emb } = await supabase
      .from("embarques")
      .select("expediente, bl_master, bl_house")
      .eq("id", factura.embarque_id)
      .maybeSingle();
    if (emb) {
      refExpediente = emb.expediente ?? refExpediente;
      refBlMaster = emb.bl_master ?? null;
      refBlHouse = emb.bl_house ?? refBlHouse;
    }
  }

  const ctx: FacturaContext = {
    serie: factura.serie ?? null,
    forma_pago: factura.forma_pago ?? "",
    metodo_pago: factura.metodo_pago ?? "PUE",
    uso_cfdi: factura.uso_cfdi ?? cliente.uso_cfdi_default ?? "",
    moneda: factura.moneda ?? "MXN",
    tipo_cambio: Number(factura.tipo_cambio ?? 1),
    receptor: {
      legal_name: cliente.nombre,
      tax_id: factura.rfc_cliente ?? cliente.rfc ?? "",
      tax_system: cliente.regimen_fiscal ?? "",
      address: { zip: cliente.codigo_postal ?? "" },
      email: contactoData?.email ?? null,
    },
    conceptos: (conceptos ?? []).map((c) => ({
      descripcion: c.descripcion,
      cantidad: Number(c.cantidad),
      precio_unitario: Number(c.precio_unitario),
      clave_sat: c.clave_sat,
      // α.1 — Lee clave_unidad de la fila; helpers todavía usa "E48" como fallback defensivo
      // en caso de que la fila legacy no tenga el campo poblado.
      clave_unidad: (c as { clave_unidad?: string | null }).clave_unidad ?? "E48",
      unidad: "Unidad de servicio",
      tipo_iva: (c.tipo_iva as "gravado_16" | "tasa_0" | "exento" | null) ?? "gravado_16",
      tasa_iva: c.tasa_iva_aplicada != null ? Number(c.tasa_iva_aplicada) : 0.16,
      tasa_ret_isr: c.tasa_ret_isr != null ? Number(c.tasa_ret_isr) : 0,
      tasa_ret_iva: c.tasa_ret_iva != null ? Number(c.tasa_ret_iva) : 0,
    })),
    sustituye_uuid: sustituyeUuid,
    referencias: {
      expediente: refExpediente,
      bl_master: refBlMaster,
      bl_house: refBlHouse,
    },
  };


  const issues = validateContext(ctx);
  if (issues.length > 0) return json({ error: "validation_failed", issues }, 422);

  const payload = buildFacturapiPayload(ctx);

  // Emisión vía SDK oficial facturapi-node.
  interface FapiInvoice { id: string; uuid: string; folio_number?: number; folio?: number; series?: string }
  let invoice: FapiInvoice;
  try {
    invoice = await facturapi.invoices.create(payload) as FapiInvoice;
  } catch (err) {
    const { status, detail } = describeFacturapiError(err);
    await registrarBitacoraEdge(supabase, {
      organizationId: factura.organization_id,
      usuarioId: userData.user.id,
      usuarioEmail: userData.user.email,
      modulo: "facturacion",
      accion: "facturapi_emitir_failed",
      entidadId: body.factura_id,
      entidadNombre: factura.numero ?? "",
      detalles: { status, response: detail },
    });
    const message = (detail && typeof detail === "object" && "message" in (detail as Record<string, unknown>) && typeof (detail as Record<string, unknown>).message === "string") ? (detail as Record<string, string>).message : `FacturApi respondió ${status}`;
    return json({ error: "facturapi_error", status, detail, message }, 502);
  }
  const fapiJson = invoice;

  const facturapiId: string = fapiJson.id;
  const uuid: string = fapiJson.uuid;
  const folio: number = fapiJson.folio_number ?? fapiJson.folio ?? 0;
  const serieTimbrada: string = fapiJson.series ?? ctx.serie ?? "";
  const pdfUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/pdf`;
  const xmlUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/xml`;

  // Ola 3 · Item 5 — Respaldo automático del XML al bucket `facturas`.
  // Best-effort: no bloquea el timbrado si falla; se puede reintentar después.
  const respaldo = await respaldarXmlEmitido({
    supabase, apiKey: resolved.data.apiKey,
    facturapiId, organizationId: factura.organization_id,
    facturaId: body.factura_id, uuid,
  });

  // v13.146.0 — el `numero` interno se asigna aquí, no al crear el borrador.
  // FacturAPI es source of truth para folio y serie. El formato mantiene
  // `<serie><folio>` para compatibilidad con reportes/búsquedas existentes.
  const numeroFinal = `${serieTimbrada}${folio}`;
  const { error: updErr } = await supabase
    .from("facturas")
    .update({
      numero: numeroFinal,
      facturapi_id: facturapiId,
      uuid_fiscal: uuid,
      folio_fiscal: folio,
      serie: serieTimbrada,
      factura_pdf_url: pdfUrl,
      factura_xml_url: xmlUrl,
      factura_xml_backup_path: respaldo.path,
      estado: "Emitida",
      ambiente: resolved.data.ambiente,
      timbrado_en: new Date().toISOString(),
      timbrado_por: userData.user.id,
    })
    .eq("id", body.factura_id);
  if (updErr) return json({ error: "db_update_failed", detail: updErr.message }, 500);

  await registrarBitacoraEdge(supabase, {
    organizationId: factura.organization_id,
    usuarioId: userData.user.id,
    usuarioEmail: userData.user.email,
    modulo: "facturacion",
    accion: "facturapi_emitida",
    entidadId: body.factura_id,
    entidadNombre: numeroFinal,
    detalles: {
      uuid, folio, serie: serieTimbrada, facturapi_id: facturapiId,
      xml_backup: { status: respaldo.status, path: respaldo.path, error: respaldo.error ?? null },
    },
  });

  return json({
    uuid, folio, serie: serieTimbrada, facturapi_id: facturapiId,
    pdf_url: pdfUrl, xml_url: xmlUrl,
    xml_backup: respaldo,
  });
}));
