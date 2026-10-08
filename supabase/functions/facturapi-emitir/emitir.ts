/**
 * Lógica de negocio de `facturapi-emitir` extraída para que `index.ts` cumpla
 * con el límite de líneas y funciones. No contiene routing ni HTTP.
 * La carga del contexto fiscal vive en `contexto.ts`.
 */
import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsonResponse } from "../_shared/response.ts";
import { validarTotalPositivo, validarLimiteCredito } from "./credito.ts";
import { validarTcFiscal } from "../_shared/tcBanda.ts";
import { buildFacturapiPayload } from "./helpers.ts";
import { respaldarXmlEmitido } from "./respaldarXml.ts";
import { esTimbradoPendiente } from '../_shared/timbradoPendiente.ts';


import { registrarFacturaPendiente } from "./pendiente.ts";
import { FACTURA_COLUMNS, type Claim, type FacturaRow, type EmitirInput } from "./types.ts";

import { resultadoUsoCfdi } from "./resultadoUsoCfdi.ts";
import { createInvoiceInFacturapi } from './crear.ts';
import { parseInvoiceResult, persistirFacturaTimbrada } from './persistencia.ts';

export { hoyMx, realinearFechaEmision } from "./fechaEmision.ts";
export type { Claim, FacturaRow } from "./types.ts";
export { cargarContexto } from "./contexto.ts";


/**
 * Ola 3 · B — Estados de factura realmente timbrables en el flujo actual:
 * la bandeja "Por timbrar" lista borradores (`estado = Borrador`) y el enum
 * `estado_factura` incluye además "Por timbrar". Emitida/Pagada/Parcialmente
 * pagada/Vencida/Cancelada/Sustituida NUNCA se re-timbran.
 */
export const ESTADOS_FACTURA_TIMBRABLES: readonly string[] = ["Borrador", "Por timbrar"];

export async function loadFactura(supabase: SupabaseClient, facturaId: string): Promise<FacturaRow | Response> {
  const { data: factura, error: fErr } = await supabase
    .from("facturas")
    .select(FACTURA_COLUMNS)
    .eq("id", facturaId)
    // Ola 3 · B: una factura en papelera no es timbrable ni por llamada directa.
    .is("deleted_at", null)
    .maybeSingle();
  if (fErr || !factura) return jsonResponse({ error: "factura_not_found", message: "No encontramos la factura (pudo eliminarse o moverse a la papelera).", detail: fErr?.message }, 404);
  return factura as FacturaRow;
}

/**
 * Ola 3 · B — boundary server-side: aunque la UI se equivoque, una llamada
 * directa no puede timbrar una factura en un estado no timbrable.
 */
export function validarEstadoTimbrable(factura: FacturaRow): Response | null {
  const estado = factura.estado ?? "";
  if (ESTADOS_FACTURA_TIMBRABLES.includes(estado)) return null;
  return jsonResponse({
    error: "estado_no_timbrable",
    message: `Esta factura está en estado "${estado}" y ya no se puede timbrar.`,
  }, 409);
}

/**
 * Ola 2 · B — banda canónica compartida (5..40 MXN por divisa) en lugar del
 * criterio local `> 1`, que dejaba pasar dedazos como 4.99 o 100.
 * Se ejecuta ANTES de cualquier llamada a FacturAPI.
 */
export function validarTipoCambio(factura: FacturaRow): Response | null {
  const monedaFactura = factura.moneda ?? "MXN";
  const problema = validarTcFiscal(monedaFactura, factura.tipo_cambio);
  if (problema) {
    return jsonResponse({ error: "tipo_cambio_requerido", message: problema }, 422);
  }
  return null;
}

/**
 * Ola 3 · B — todas las validaciones previas al PAC en un solo boundary
 * (estado timbrable → tipo de cambio → total > 0 → límite de crédito).
 * Se agrupan aquí para que el handler quede lineal.
 *
 * La fecha de emisión ya NO se valida aquí: `realinearFechaEmision`
 * (fechaEmision.ts) la pone en el día del timbre antes de estas validaciones,
 * y el trigger del DOF vuelve a resolver el tipo de cambio.
 */
export async function validarFacturaTimbrable(
  supabase: SupabaseClient,
  factura: FacturaRow,
  userId: string,
): Promise<Response | null> {
  return validarEstadoTimbrable(factura)
    ?? validarTipoCambio(factura)
    ?? validarTotalPositivo(factura)
    ?? (await validarLimiteCredito(supabase, factura, userId));
}

export async function claimFactura(supabase: SupabaseClient, facturaId: string): Promise<Claim | Response> {
  const claimTag = `PENDING:${crypto.randomUUID()}`;
  const claimAt = new Date().toISOString();
  const { data: claimed, error: claimErr } = await supabase
    .from("facturas")
    .update({ facturapi_id: claimTag, facturapi_claim_at: claimAt })
    .eq("id", facturaId)
    .is("facturapi_id", null)
    // Ola 3 · B: el claim repite el guard de vivo + estado timbrable, así la
    // carrera entre load y claim (borrado o cambio de estado en medio) no
    // termina en un CFDI.
    .is("deleted_at", null)
    .in("estado", ESTADOS_FACTURA_TIMBRABLES)
    .select("id")
    .maybeSingle();
  if (claimErr) {
    // L2 (auditoría 3-3): el detalle sólo va a logs; al cliente un código estable.
    console.error("claim_failed", { facturaId, code: claimErr.code });
    return jsonResponse({ error: "claim_failed", message: "No se pudo reservar la factura para timbrar. Intenta de nuevo." }, 500);
  }
  if (!claimed) return jsonResponse({ error: "ya_timbrada", message: "Otro usuario ya está timbrando esta factura, o la factura dejó de ser timbrable." }, 409);
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


export async function emitirYActualizar(input: EmitirInput): Promise<Response> {
  const { supabase, apiKey, ctx, factura, facturaId } = input;
  const payload = buildFacturapiPayload(ctx);

  const invoice = await createInvoiceInFacturapi(input, payload);
  if (invoice instanceof Response) return invoice;

  // P0-A: `status: "pending"` o UUID ausente ⇒ NO está timbrado. Se conserva el
  // claim, no se respalda XML y se responde 202.
  if (esTimbradoPendiente(invoice)) {
    return await registrarFacturaPendiente({
      supabase, facturaId, organizationId: factura.organization_id, numero: factura.numero ?? null,
      claimTag: input.claim.claimTag, pendienteId: invoice.id ?? null,
      usuarioId: input.user.id, usuarioEmail: input.user.email,
    });
  }

  const resultado = parseInvoiceResult(invoice, ctx);
  const respaldo = await respaldarXmlEmitido({
    supabase, apiKey, facturapiId: resultado.facturapiId,
    organizationId: factura.organization_id, facturaId, uuid: resultado.uuid,
  });

  const persistError = await persistirFacturaTimbrada(input, resultado, respaldo);
  if (persistError) return persistError;

  return jsonResponse({
    ...resultadoUsoCfdi(ctx.uso_cfdi, respaldo.usoCfdi),
    uuid: resultado.uuid, folio: resultado.folio, serie: resultado.serie,
    facturapi_id: resultado.facturapiId, pdf_url: resultado.pdfUrl, xml_url: resultado.xmlUrl, xml_backup: respaldo,
  });
}
