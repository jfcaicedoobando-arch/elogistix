/**
 * Lógica de negocio de `facturapi-emitir` extraída para que `index.ts` cumpla
 * con el límite de líneas y funciones. No contiene routing ni HTTP.
 * La carga del contexto fiscal vive en `contexto.ts`.
 */
import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getFacturapiClient, describeFacturapiError, withFacturapiTimeout, FacturapiTimeoutError, type FacturapiClient } from "../_shared/facturapiClient.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse } from "../_shared/response.ts";
import {
  FACTURAPI_BASE, buildFacturapiPayload,
  type FacturaContext,
} from "./helpers.ts";
import { respaldarXmlEmitido } from "./respaldarXml.ts";
import type { Claim, FacturaRow, UserIdentity } from "./types.ts";

export type { Claim, FacturaRow } from "./types.ts";
export { cargarContexto } from "./contexto.ts";

interface EmitirInput { supabase: SupabaseClient; facturapi: FacturapiClient; apiKey: string; ambiente: string; ctx: FacturaContext; factura: FacturaRow; facturaId: string; user: UserIdentity; claim: Claim }

export async function loadFactura(supabase: SupabaseClient, facturaId: string): Promise<FacturaRow | Response> {
  const { data: factura, error: fErr } = await supabase
    .from("facturas")
    .select("id, numero, serie, estado, moneda, tipo_cambio, uso_cfdi, forma_pago, metodo_pago, cliente_id, rfc_cliente, organization_id, facturapi_id, sustituye_a, embarque_id, expediente, referencia_bl, subtotal, total")
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
  if (claimErr) {
    // L2 (auditoría 3-3): el detalle sólo va a logs; al cliente un código estable.
    console.error("claim_failed", { facturaId, code: claimErr.code });
    return jsonResponse({ error: "claim_failed", message: "No se pudo reservar la factura para timbrar. Intenta de nuevo." }, 500);
  }
  if (!claimed) return jsonResponse({ error: "ya_timbrada", message: "Otro usuario ya está timbrando esta factura." }, 409);
  const release = async () => { await supabase.from("facturas").update({ facturapi_id: null, facturapi_claim_at: null }).eq("id", facturaId).eq("facturapi_id", claimTag); };
  return { claimTag, claimAt, release };
}

export async function resolverSustitucion(supabase: SupabaseClient, factura: FacturaRow): Promise<string | Response | null> {
  if (!factura.sustituye_a) return null;
  const { data: prev } = await supabase.from("facturas").select("uuid_fiscal").eq("id", factura.sustituye_a).maybeSingle();
  // REF-06: ya no se libera claim aquí — el claim se toma DESPUÉS de esta
  // validación (ver index.ts), así que no hay nada que liberar en el 422.
  if (!prev?.uuid_fiscal) return jsonResponse({ error: "sustituida_sin_uuid", message: "La factura sustituida no tiene UUID fiscal." }, 422);
  return prev.uuid_fiscal as string;
}


interface FapiInvoice { id: string; uuid: string; folio_number?: number; folio?: number; series?: string }

async function createInvoiceInFacturapi(
  input: EmitirInput,
  payload: ReturnType<typeof buildFacturapiPayload>,
): Promise<FapiInvoice | Response> {
  const { supabase, facturapi, factura, facturaId, user, claim } = input;
  try {
    // FIX-04/32 — timeout defensivo: si FacturApi cuelga devolvemos 504 en vez
    // de dejar la Edge Function ocupada 150 s.
    return await withFacturapiTimeout("invoices.create", facturapi.invoices.create(payload)) as FapiInvoice;
  } catch (err) {
    if (err instanceof FacturapiTimeoutError) {
      // EF-02 (auditoría): en timeout NO liberamos el claim. Si FacturApi sí
      // timbró, el tag PENDING:<uuid> (external_id) es la única correlación que
      // permite a facturapi-recuperar-claim adoptar el CFDI; liberarlo aquí
      // convertía un timeout benigno en un CFDI duplicado al reintentar.
      await registrarBitacoraEdge(supabase, {
        organizationId: factura.organization_id, usuarioId: user.id, usuarioEmail: user.email, modulo: "facturacion",
        accion: "facturapi_emitir_timeout", entidadId: facturaId, entidadNombre: factura.numero ?? "",
        detalles: { op: err.op, timeout_ms: err.timeoutMs },
      });
      return jsonResponse({ error: "facturapi_timeout", message: `${err.message}. Espera ~3 min y usa 'Recuperar timbrado' — no reintentes el timbrado directamente.`, timeout_ms: err.timeoutMs }, 504);
    }
    // Error definitivo de FacturApi (no timbró): sí liberamos para reintentar.
    await claim.release();
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
