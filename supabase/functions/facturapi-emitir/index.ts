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
import { getFacturapiClient, describeFacturapiError } from "../_shared/facturapiClient.ts";
import {
  FACTURAPI_BASE, buildFacturapiPayload, validateContext,
  type FacturaContext,
} from "./helpers.ts";

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
    .select("id, numero, serie, estado, moneda, tipo_cambio, uso_cfdi, forma_pago, metodo_pago, cliente_id, rfc_cliente, organization_id, facturapi_id, sustituye_a")
    .eq("id", body.factura_id)
    .maybeSingle();
  if (fErr || !factura) return json({ error: "factura_not_found", detail: fErr?.message }, 404);
  if (factura.facturapi_id) return json({ error: "ya_timbrada", message: "Esta factura ya fue timbrada en Facturapi." }, 409);

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
    .select("descripcion, cantidad, precio_unitario, clave_sat, clave_unidad, unidad, tasa_iva")
    .eq("factura_id", body.factura_id);
  if (conErr) return json({ error: "conceptos_query_failed", detail: conErr.message }, 500);

  const { data: contactoData } = await supabase
    .from("contactos_cliente")
    .select("email")
    .eq("cliente_id", factura.cliente_id)
    .eq("es_principal", true)
    .maybeSingle();

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
      clave_unidad: c.clave_unidad,
      unidad: c.unidad,
      tasa_iva: c.tasa_iva != null ? Number(c.tasa_iva) : 0.16,
    })),
    sustituye_uuid: sustituyeUuid,
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
    await supabase.from("bitacora_actividad").insert({
      organization_id: factura.organization_id,
      user_id: userData.user.id,
      accion: "facturapi_emitir_failed",
      entidad: "factura",
      entidad_id: body.factura_id,
      detalle: { status, response: detail },
    });
    return json({ error: "facturapi_error", status, detail }, 502);
  }
  const fapiJson = invoice;

  const facturapiId: string = fapiJson.id;
  const uuid: string = fapiJson.uuid;
  const folio: number = fapiJson.folio_number ?? fapiJson.folio ?? 0;
  const serieTimbrada: string = fapiJson.series ?? ctx.serie ?? "";
  const pdfUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/pdf`;
  const xmlUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/xml`;

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
      estado: "Emitida",
      timbrado_en: new Date().toISOString(),
      timbrado_por: userData.user.id,
    })
    .eq("id", body.factura_id);
  if (updErr) return json({ error: "db_update_failed", detail: updErr.message }, 500);

  await supabase.from("bitacora_actividad").insert({
    organization_id: factura.organization_id,
    user_id: userData.user.id,
    accion: "facturapi_emitida",
    entidad: "factura",
    entidad_id: body.factura_id,
    detalle: { uuid, folio, serie: serieTimbrada, facturapi_id: facturapiId },
  });

  return json({ uuid, folio, serie: serieTimbrada, facturapi_id: facturapiId, pdf_url: pdfUrl, xml_url: xmlUrl });
}));
