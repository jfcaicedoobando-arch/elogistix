/**
 * Lógica de negocio de `facturapi-recuperar-claim` extraída para reducir la
 * complejidad ciclomática del handler HTTP.
 */
import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse } from "../_shared/response.ts";
import { FACTURAPI_BASE } from "../facturapi-emitir/helpers.ts";
import { withFacturapiTimeout, FacturapiTimeoutError } from "../_shared/facturapiClient.ts";
import { respaldarXmlTimbrado, type RespaldoResult } from "../_shared/respaldarXmlTimbrado.ts";

export const MIN_EDAD_MINUTOS = 3;

// Ola 5 · RG4-4: la misma recuperación aplica a notas de crédito (claim
// PENDING:<uuid> + external_id desde Ola 4 · N1).
export interface ReqBody { factura_id?: string; nota_credito_id?: string; pago_id?: string }
export interface FacturaRow {
  id: string;
  organization_id: string;
  facturapi_id: string | null;
  facturapi_claim_at: string | null;
  serie: string | null;
  numero: string | null;
}
export interface UserIdentity { id: string; email?: string | null }

export interface FapiInvoice {
  id?: string;
  uuid?: string;
  folio_number?: number;
  series?: string;
  external_id?: string;
  status?: string;
  date?: string;
}
interface FapiListResponse { data?: FapiInvoice[]; total_pages?: number; page?: number }
export interface FapiClient { invoices: { list: (params: Record<string, unknown>) => Promise<FapiListResponse> } }

export async function loadFactura(supabase: SupabaseClient, facturaId: string): Promise<FacturaRow | Response> {
  const { data: factura, error: fErr } = await supabase
    .from("facturas")
    .select("id, organization_id, facturapi_id, facturapi_claim_at, serie, numero")
    .eq("id", facturaId)
    .maybeSingle<FacturaRow>();
  if (fErr || !factura) return jsonResponse({ error: "factura_not_found", detail: fErr?.message }, 404);
  return factura;
}

/** Ola 5 · RG4-4: fila mínima con claim; la comparten `facturas` y `factura_notas_credito`. */
export interface ClaimRow { facturapi_id: string | null; facturapi_claim_at: string | null }

export function validarClaim(row: ClaimRow, entidad = "factura"): { claimTag: string; edadMin: number; response?: Response } {
  const claimTag = row.facturapi_id ?? "";
  if (!claimTag.startsWith("PENDING:")) {
    return {
      claimTag, edadMin: 0,
      response: jsonResponse({ outcome: "no_pending", message: `La ${entidad} no tiene un claim pendiente.`, facturapi_id: row.facturapi_id }),
    };
  }
  const edadMin = row.facturapi_claim_at
    ? (Date.now() - new Date(row.facturapi_claim_at).getTime()) / 60_000
    : Infinity;
  if (edadMin < MIN_EDAD_MINUTOS) {
    return {
      claimTag, edadMin,
      response: jsonResponse({ outcome: "too_early", message: `El claim aún está dentro del umbral de gracia (${MIN_EDAD_MINUTOS} min).`, edad_minutos: Math.round(edadMin * 10) / 10 }, 425),
    };
  }
  return { claimTag, edadMin };
}

export async function buscarCfdiPorExternalId(client: FapiClient, claimTag: string, claimAt: string | null): Promise<FapiInvoice | null | Response> {
  try {
    const desde = claimAt
      ? new Date(new Date(claimAt).getTime() - 5 * 60_000).toISOString()
      : new Date(Date.now() - 24 * 3600_000).toISOString();
    let page = 1;
    const maxPages = 5;
    while (page <= maxPages) {
      // FIX-04/32 — timeout defensivo en el SDK.
      const res = await withFacturapiTimeout(
        "invoices.list",
        client.invoices.list({ page, limit: 50, "date[gt]": desde }),
      );
      const items = res.data ?? [];
      const match = items.find((inv) => inv.external_id === claimTag) ?? null;
      if (match) return match;
      if (!res.total_pages || page >= (res.total_pages ?? 1)) break;
      page += 1;
    }
    return null;
  } catch (err) {
    if (err instanceof FacturapiTimeoutError) {
      return jsonResponse({ error: "facturapi_timeout", message: err.message, timeout_ms: err.timeoutMs }, 504);
    }
    const detail = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: "facturapi_error", message: detail }, 502);
  }
}

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

export interface PromoverInput {
  supabase: SupabaseClient; factura: FacturaRow; match: FapiInvoice; claimTag: string; user: UserIdentity; ambiente: string;
}

export async function promoverFactura(input: PromoverInput): Promise<Response> {
  const { supabase, factura, match, claimTag, user, ambiente } = input;
  const facturapiId = match.id!;
  const uuid = match.uuid!;
  const folio = match.folio_number ?? 0;
  const serieTimbrada = match.series ?? factura.serie ?? "";
  const pdfUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/pdf`;
  const xmlUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/xml`;
  const { error: updErr, data: updRow } = await supabase
    .from("facturas")
    .update({
      numero: `${serieTimbrada}${folio}`, facturapi_id: facturapiId, facturapi_claim_at: null,
      uuid_fiscal: uuid, folio_fiscal: folio, serie: serieTimbrada,
      factura_pdf_url: pdfUrl, factura_xml_url: xmlUrl, estado: "Emitida", ambiente,
      timbrado_en: match.date ?? new Date().toISOString(), timbrado_por: user.id,
    })
    .eq("id", factura.id)
    .eq("facturapi_id", claimTag)
    .select("id")
    .maybeSingle();
  if (updErr) return jsonResponse({ error: "db_update_failed", detail: updErr.message }, 500);
  if (!updRow) return jsonResponse({ outcome: "claim_perdido", message: "El claim cambió mientras se recuperaba; revisa el estado actual." }, 409);

  await registrarBitacoraEdge(supabase, {
    organizationId: factura.organization_id, usuarioId: user.id, usuarioEmail: user.email, modulo: "facturacion",
    accion: "facturapi_claim_recuperado_promovido", entidadId: factura.id, entidadNombre: `${serieTimbrada}${folio}`,
    detalles: { facturapi_id: facturapiId, uuid, folio, serie: serieTimbrada, external_id: claimTag },
  });
  return jsonResponse({ outcome: "promovido", message: "Se recuperó el CFDI que ya estaba timbrado en FacturAPI.", facturapi_id: facturapiId, uuid, folio, serie: serieTimbrada });
}

export async function liberarClaim(
  supabase: SupabaseClient, factura: FacturaRow, claimTag: string, edadMin: number, user: UserIdentity,
): Promise<Response> {
  const { data: liberado, error: rpcErr } = await supabase.rpc(
    "liberar_claim_facturapi_huerfano",
    { p_factura_id: factura.id, p_min_edad_minutos: MIN_EDAD_MINUTOS },
  );
  if (rpcErr) return jsonResponse({ error: "release_failed", detail: rpcErr.message }, 500);

  await registrarBitacoraEdge(supabase, {
    organizationId: factura.organization_id, usuarioId: user.id, usuarioEmail: user.email, modulo: "facturacion",
    accion: "facturapi_claim_recuperado_liberado", entidadId: factura.id, entidadNombre: factura.numero ?? "",
    detalles: { liberado: !!liberado, external_id: claimTag, edad_minutos: Math.round(edadMin * 10) / 10 },
  });

  return jsonResponse({
    outcome: liberado ? "liberado" : "sin_cambios",
    message: liberado
      ? "No hay CFDI timbrado en FacturAPI; se liberó el claim para reintentar."
      : "No hay CFDI en FacturAPI, pero el claim ya no cumplía condiciones para liberarse.",
    edad_minutos: Math.round(edadMin * 10) / 10,
  });
}


/* ── Ola 5 · RG4-4 — recuperación de claims en notas de crédito ──────────
 * La emisión de NC (Ola 4 · N1) reclama la fila con PENDING:<uuid> y envía
 * ese tag como external_id. Si la edge muere entre el timbrado y el persist,
 * preloadNcContext devuelve 409 ya_timbrada para siempre: estas funciones
 * extienden a `factura_notas_credito` la misma reconciliación que ya existía
 * para `facturas`. */

export interface NotaCreditoRow {
  id: string;
  organization_id: string;
  facturapi_id: string | null;
  facturapi_claim_at: string | null;
  serie: string | null;
  folio: string | null;
}

export async function loadNotaCredito(supabase: SupabaseClient, notaCreditoId: string): Promise<NotaCreditoRow | Response> {
  const { data: nc, error: ncErr } = await supabase
    .from("factura_notas_credito")
    .select("id, organization_id, facturapi_id, facturapi_claim_at, serie, folio")
    .eq("id", notaCreditoId)
    .maybeSingle<NotaCreditoRow>();
  if (ncErr || !nc) return jsonResponse({ error: "nota_credito_not_found", detail: ncErr?.message }, 404);
  return nc;
}

export interface PromoverNcInput {
  supabase: SupabaseClient; nc: NotaCreditoRow; match: FapiInvoice; claimTag: string; user: UserIdentity; apiKey: string; ambiente: string;
}

/**
 * Adopta el CFDI tipo E que FacturAPI sí timbró con el `external_id` del
 * claim. Espejo de `promoverFactura` (misma guarda `.eq("facturapi_id",
 * claimTag)` con 409 claim_perdido) y de `persistTimbradoNc` de
 * facturapi-emitir-nota-credito (folio `<serie><folio>`, estado 'Timbrada',
 * respaldo XML best-effort en el bucket `facturas`, folder `notas-credito`).
 */
export async function promoverNc(input: PromoverNcInput): Promise<Response> {
  const { supabase, nc, match, claimTag, user, apiKey, ambiente } = input;
  const facturapiId = match.id!;
  const uuid = match.uuid!;
  const folio = match.folio_number ?? 0;
  const serieTimbrada = match.series ?? nc.serie ?? "";
  const folioFinal = `${serieTimbrada}${folio}`;
  const pdfUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/pdf`;
  const xmlUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/xml`;

  // Respaldo best-effort (mismo helper del timbrado). Se omite sin apiKey
  // para mantener los tests de esta función herméticos (sin red).
  const respaldo: RespaldoResult = apiKey
    ? await respaldarXmlTimbrado({ supabase, apiKey, facturapiId, organizationId: nc.organization_id, uuid, folder: "notas-credito" })
    : { path: null, status: "skipped" };

  const { error: updErr, data: updRow } = await supabase
    .from("factura_notas_credito")
    .update({
      folio: folioFinal, facturapi_id: facturapiId, facturapi_claim_at: null,
      uuid_fiscal: uuid, folio_fiscal: folio, serie: serieTimbrada,
      pdf_url: pdfUrl, xml_url: xmlUrl, xml_backup_path: respaldo.path,
      estado: "Timbrada", ambiente,
      timbrado_en: match.date ?? new Date().toISOString(), timbrado_por: user.id,
    })
    .eq("id", nc.id)
    // Persistir sólo si seguimos poseyendo el claim — evita pisar el
    // facturapi_id si el usuario reintentó el timbrado en paralelo.
    .eq("facturapi_id", claimTag)
    .select("id")
    .maybeSingle();
  if (updErr) return jsonResponse({ error: "db_update_failed", detail: updErr.message }, 500);
  if (!updRow) return jsonResponse({ outcome: "claim_perdido", message: "El claim cambió mientras se recuperaba; revisa el estado actual." }, 409);

  await registrarBitacoraEdge(supabase, {
    organizationId: nc.organization_id, usuarioId: user.id, usuarioEmail: user.email, modulo: "facturacion",
    accion: "facturapi_nc_claim_recuperado_promovido", entidadId: nc.id, entidadNombre: folioFinal,
    detalles: {
      facturapi_id: facturapiId, uuid, folio, serie: serieTimbrada, external_id: claimTag,
      xml_backup: { status: respaldo.status, path: respaldo.path, error: respaldo.error ?? null },
    },
  });
  return jsonResponse({ outcome: "promovido", message: "Se recuperó el CFDI de la nota de crédito que ya estaba timbrado en FacturAPI.", facturapi_id: facturapiId, uuid, folio, serie: serieTimbrada });
}

/**
 * Libera el claim de una NC cuando FacturAPI NO tiene el CFDI. A diferencia
 * de facturas (RPC `liberar_claim_facturapi_huerfano`), aquí no se crea una
 * RPC/migración nueva: la edge ya verificó membresía y rol (`authorizeOrgRole`
 * + ROLES_EMISOR_FISCAL en index.ts) y corre con service role; el UPDATE
 * replica los mismos predicados (claimTag exacto + edad >= umbral), así una
 * carrera con un reintento del usuario no puede pisarlo. Nota: con
 * `facturapi_claim_at` NULL no se libera (igual que la RPC de facturas).
 */
export async function liberarClaimNc(
  supabase: SupabaseClient, nc: NotaCreditoRow, claimTag: string, edadMin: number, user: UserIdentity,
): Promise<Response> {
  const limite = new Date(Date.now() - MIN_EDAD_MINUTOS * 60_000).toISOString();
  const { data: liberado, error: updErr } = await supabase
    .from("factura_notas_credito")
    .update({ facturapi_id: null, facturapi_claim_at: null })
    .eq("id", nc.id)
    .eq("facturapi_id", claimTag)
    .lt("facturapi_claim_at", limite)
    .select("id")
    .maybeSingle();
  if (updErr) return jsonResponse({ error: "release_failed", detail: updErr.message }, 500);

  await registrarBitacoraEdge(supabase, {
    organizationId: nc.organization_id, usuarioId: user.id, usuarioEmail: user.email, modulo: "facturacion",
    accion: "facturapi_nc_claim_recuperado_liberado", entidadId: nc.id, entidadNombre: nc.folio ?? "",
    detalles: { liberado: !!liberado, external_id: claimTag, edad_minutos: Math.round(edadMin * 10) / 10 },
  });

  return jsonResponse({
    outcome: liberado ? "liberado" : "sin_cambios",
    message: liberado
      ? "No hay CFDI timbrado en FacturAPI; se liberó la reserva de la nota de crédito para reintentar."
      : "No hay CFDI en FacturAPI, pero el claim ya no cumplía condiciones para liberarse.",
    edad_minutos: Math.round(edadMin * 10) / 10,
  });
}
