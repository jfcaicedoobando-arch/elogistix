/**
 * Recuperación de claims de REPs (pagos_factura). Extraído de `recuperar.ts`
 * (Power of 10: archivos ≤250 líneas).
 */
import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse } from "../_shared/response.ts";
import { FACTURAPI_BASE } from "../facturapi-emitir/helpers.ts";
import { respaldarXmlTimbrado, type RespaldoResult } from "../_shared/respaldarXmlTimbrado.ts";
import { MIN_EDAD_MINUTOS, type FapiInvoice, type UserIdentity } from "./recuperar.tipos.ts";

/* ── EF-01 — recuperación de claims en REPs (pagos_factura) ──────────────
 * facturapi-emitir-rep reclama la fila con PENDING:<uuid> y envía ese tag
 * como external_id. Si la edge muere entre el timbrado y el persist, el
 * pago queda 409 ya_timbrado_rep para siempre: estas funciones extienden a
 * `pagos_factura` la misma reconciliación que ya existía para facturas/NC. */

export interface PagoRow {
  id: string;
  organization_id: string;
  facturapi_rep_id: string | null;
  facturapi_rep_claim_at: string | null;
  factura_id: string | null;
}

export async function loadPago(supabase: SupabaseClient, pagoId: string): Promise<PagoRow | Response> {
  const { data: pago, error: pErr } = await supabase
    .from("pagos_factura")
    .select("id, organization_id, facturapi_rep_id, facturapi_rep_claim_at, factura_id")
    .eq("id", pagoId)
    .maybeSingle<PagoRow>();
  if (pErr || !pago) return jsonResponse({ error: "pago_not_found", detail: pErr?.message }, 404);
  return pago;
}

export interface PromoverPagoInput {
  supabase: SupabaseClient; pago: PagoRow; match: FapiInvoice; claimTag: string; user: UserIdentity; apiKey: string; ambiente: string;
}

/**
 * Adopta el REP (complemento de pago) que FacturAPI sí timbró con el
 * `external_id` del claim. Espejo de `promoverFactura`/`promoverNc`.
 */
export async function promoverPago(input: PromoverPagoInput): Promise<Response> {
  const { supabase, pago, match, claimTag, user, apiKey, ambiente } = input;
  const facturapiId = match.id!;
  const uuid = match.uuid!;
  const folio = match.folio_number ?? 0;
  const serieTimbrada = match.series ?? "";
  const pdfUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/pdf`;
  const xmlUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/xml`;

  const respaldo: RespaldoResult = apiKey
    ? await respaldarXmlTimbrado({ supabase, apiKey, facturapiId, organizationId: pago.organization_id, uuid, folder: "rep" })
    : { path: null, status: "skipped" };

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
      ambiente,
      timbrado_rep_en: match.date ?? new Date().toISOString(),
      timbrado_rep_por: user.id,
      rep_error: null,
    })
    .eq("id", pago.id)
    // Persistir sólo si seguimos poseyendo el claim — evita pisar el
    // facturapi_rep_id de otro timbrado concurrente.
    .eq("facturapi_rep_id", claimTag)
    .select("id")
    .maybeSingle();
  if (updErr) return jsonResponse({ error: "db_update_failed", detail: updErr.message }, 500);
  if (!updRow) return jsonResponse({ outcome: "claim_perdido", message: "El claim cambió mientras se recuperaba; revisa el estado actual." }, 409);

  await registrarBitacoraEdge(supabase, {
    organizationId: pago.organization_id, usuarioId: user.id, usuarioEmail: user.email, modulo: "facturacion",
    accion: "facturapi_rep_claim_recuperado_promovido", entidadId: pago.id, entidadNombre: `${serieTimbrada}${folio}`,
    detalles: {
      facturapi_id: facturapiId, uuid, folio, serie: serieTimbrada, external_id: claimTag,
      xml_backup: { status: respaldo.status, path: respaldo.path, error: respaldo.error ?? null },
    },
  });
  return jsonResponse({ outcome: "promovido", message: "Se recuperó el REP que ya estaba timbrado en FacturAPI.", facturapi_id: facturapiId, uuid, folio, serie: serieTimbrada });
}

/** Libera el claim de un REP cuando FacturAPI NO tiene el CFDI, vía RPC `liberar_claim_rep_huerfano`. */
export async function liberarClaimPago(
  supabase: SupabaseClient, pago: PagoRow, claimTag: string, edadMin: number, user: UserIdentity,
): Promise<Response> {
  const { data: liberado, error: rpcErr } = await supabase.rpc(
    "liberar_claim_rep_huerfano",
    { p_pago_id: pago.id, p_min_edad_minutos: MIN_EDAD_MINUTOS },
  );
  if (rpcErr) return jsonResponse({ error: "release_failed", detail: rpcErr.message }, 500);

  await registrarBitacoraEdge(supabase, {
    organizationId: pago.organization_id, usuarioId: user.id, usuarioEmail: user.email, modulo: "facturacion",
    accion: "facturapi_rep_claim_recuperado_liberado", entidadId: pago.id, entidadNombre: "",
    detalles: { liberado: !!liberado, external_id: claimTag, edad_minutos: Math.round(edadMin * 10) / 10 },
  });

  return jsonResponse({
    outcome: liberado ? "liberado" : "sin_cambios",
    message: liberado
      ? "No hay CFDI timbrado en FacturAPI; se liberó el claim del REP para reintentar."
      : "No hay CFDI en FacturAPI, pero el claim ya no cumplía condiciones para liberarse.",
    edad_minutos: Math.round(edadMin * 10) / 10,
  });
}

